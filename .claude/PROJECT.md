# LLM Benchmark — Project Specification

> This file is the single source of truth for the project scope, roadmap, and architecture.
> Both the Coder and Tester agents read this file at the start of every session for context.
> It does NOT define what to do right now — the current task is always given in the prompt.

---

## Goal

A local application for blind benchmarking of LLM models. The user configures models and
evaluation criteria, runs tests (parallel requests), then scores the shuffled responses
without knowing which model produced them. Results are aggregated by weighted formula
and presented as a ranked list. All data is stored locally (SQLite). Fully offline
except for model API calls during test execution.

---

## Interfaces

| Interface | Location   | Tech                                  | Purpose                       |
|-----------|------------|---------------------------------------|-------------------------------|
| Web       | `apps/web` | Next.js 15 (App Router), Tailwind CSS | Browser UI — full feature set |
| TUI       | `apps/tui` | Ink (React for terminal)              | Terminal UI — full feature parity |

Both interfaces share **100% of business logic** via `packages/core`.

---

## Architecture

```
packages/
  core/
    src/
      db/           ← database.ts (SQLite singleton, better-sqlite3)
      security/     ← encryption.ts (keytar + AES-256-GCM)
      adapters/     ← model provider adapters
        base.ts     ← ModelAdapter interface
        openai.ts
        anthropic.ts
        ollama.ts
      models/       ← modelService.ts
      criteria/     ← criteriaService.ts
      runs/         ← runService.ts (parallel execution)
      scoring/      ← scoringService.ts + formula
      results/      ← resultsService.ts (aggregation, ranking)
      export/       ← exportService.ts (JSON / CSV / PDF)
      types.ts
      index.ts      ← all public exports

apps/
  web/              ← Next.js app, server actions call core directly
  tui/              ← Ink app, imports core directly
```

### Adapter Pattern

All model providers implement a single `ModelAdapter` interface.
New providers = new file in `core/adapters/`, no changes elsewhere.

```ts
interface ModelAdapter {
  complete(prompt: string, config: ModelCallConfig): Promise<CompletionResult>;
}

interface ModelCallConfig {
  modelId: string;
  apiKey?: string;
  baseUrl?: string;
  temperature: number;
  maxTokens: number;
}
```

---

## Data Model (SQLite)

```
Models
  id              INTEGER PRIMARY KEY
  name            TEXT        — display name (e.g. "ChatGPT")
  provider        TEXT        — provider slug (e.g. "openai", "anthropic", "ollama")
  modelId         TEXT        — model identifier (e.g. "gpt-4o")
  temperature     REAL        — e.g. 0.7
  maxTokens       INTEGER     — context window / max output tokens
  baseUrl         TEXT NULL   — custom endpoint (required for Ollama)
  encryptedApiKey TEXT NULL   — AES-256-GCM encrypted, format: iv:tag:ciphertext (base64)

CriteriaSets
  id              INTEGER PRIMARY KEY
  name            TEXT        — optional grouping label

Criteria
  id              INTEGER PRIMARY KEY
  setId           INTEGER NULL  → CriteriaSets.id
  name            TEXT          — e.g. "Точность ответа"
  maxScore        REAL          — e.g. 10
  weight          REAL          — significance multiplier, default 1

Runs
  id              INTEGER PRIMARY KEY
  prompt          TEXT
  requestsPerModel INTEGER      — number of requests sent to each model
  createdAt       INTEGER       — Unix timestamp

RunModels                       — which models participated in a run
  runId           INTEGER → Runs.id
  modelId         INTEGER → Models.id

RunCriteria                     — which criteria were used in a run
  runId           INTEGER → Runs.id
  criteriaId      INTEGER → Criteria.id

Responses
  id              INTEGER PRIMARY KEY
  runId           INTEGER → Runs.id
  modelId         INTEGER → Models.id
  content         TEXT
  tokensUsed      INTEGER NULL
  latencyMs       INTEGER NULL

ScoringSessions                 — multiple scoring rounds per run are allowed
  id              INTEGER PRIMARY KEY
  runId           INTEGER → Runs.id
  createdAt       INTEGER

Scores
  id              INTEGER PRIMARY KEY
  sessionId       INTEGER → ScoringSessions.id
  responseId      INTEGER → Responses.id
  criteriaId      INTEGER → Criteria.id
  value           REAL
```

---

## Scoring Formula

Given a scoring session for a run:

1. **Normalize** each score:
   `normalizedScore = value * 100 / criteria.maxScore`

2. **Average** normalized scores per model per criterion (across all requests):
   `avgNorm = mean(normalizedScore) for each (model, criterion)`

3. **Weight** each criterion average:
   `weightedAvg = avgNorm * criteria.weight`

4. **Total** per model:
   `total = sum(weightedAvg) across all criteria`

5. **Sort** models by `total` descending → ranked results list.

---

## Application Flow

```
1. Configure Models
   name / provider / modelId / temperature / maxTokens / apiKey

2. Configure Criteria
   name / maxScore / weight (default 1)

3. Set Up a Run
   [x] select models (checkboxes)
   [x] select criteria (checkboxes)
   prompt text
   requestsPerModel (integer)

4. Execute Run
   → parallel API calls (Promise.all per model × requestsPerModel)
   → responses stored in Responses table

5. Score Responses
   → responses shuffled in random order (blind scoring)
   → user scores each response per selected criterion
   → scores stored in Scores (linked to a new ScoringSession)

6. View Results
   → ranked list (sorted by total score, descending)
   → collapsible rows: expand to see per-criterion breakdown
   → [Detail view]: full table (response × criterion × score), sortable/filterable per column
   → export: JSON / CSV / PDF
   → re-score: start a new ScoringSession for the same run
```

---

## Roadmap

### Stage 0 — Infrastructure ✅
- Monorepo (npm workspaces: core, web, tui)
- TypeScript strict, ESLint flat config, Prettier
- CI/CD (GitHub Actions): libsecret → npm ci → type-check → lint → build
- Placeholder Web and TUI with greeting

### Stage 1 — Model Management ✅
- DB schema: Models table (name, provider, modelId, encryptedApiKey)
- Encryption: keytar + AES-256-GCM
- Core: `listModels`, `addModel`, `deleteModel`, `getDecryptedApiKey`
- Web UI: settings page — list, add, delete models
- TUI: keyboard menu — list, add, delete models
- **Note**: temperature, maxTokens, baseUrl added in Stage 1.5 migration

### Stage 1.25 — Test Infrastructure (planned)
- Install `vitest` + `@vitest/coverage-v8` in `packages/core`
- `vitest.config.ts` in core: pool=forks (native modules), coverage threshold 80%
- Mock strategy:
  - `keytar` → `vi.mock('keytar')` with in-memory key store
  - SQLite → real `better-sqlite3` with `:memory:` DB per test (reset in `beforeEach`)
- Test files co-located with source: `foo.ts` → `foo.test.ts`
- Unit tests:
  - `security/encryption.test.ts` — encrypt/decrypt round-trip, key rotation, bad input
  - `db/database.test.ts` — open, schema creation, idempotency
- Integration tests:
  - `models/modelService.test.ts` — addModel, listModels, deleteModel, getDecryptedApiKey
- Add `"test": "vitest run"` and `"test:coverage": "vitest run --coverage"` to core `package.json`
- Add `"test": "npm run test --workspaces --if-present"` to root `package.json`
- CI: add `test` step between `lint` and `build`

### Stage 1.5 — Model Schema Migration (planned)
- Add columns to Models: `temperature`, `maxTokens`, `baseUrl`
- Update `ModelInput` type and `addModel` / Web + TUI forms
- DB migration: `ALTER TABLE` for existing installs

### Stage 2 — Criteria Management (current)
- DB schema: CriteriaSets + Criteria tables
- Core: `listCriteriaSets`, `addCriteriaSet`, `deleteCriteriaSet`,
        `listCriteria`, `addCriterion`, `deleteCriterion`
- Web UI: criteria page — manage sets and criteria (name, maxScore, weight)
- TUI: criteria menu item — same operations

### Stage 3 — Run Execution (planned)
- DB schema: Runs, RunModels, RunCriteria, Responses tables
- ModelAdapter interface + OpenAI, Anthropic, Ollama implementations
- Core: `createRun`, `executeRun` (parallel via Promise.all), `listRuns`, `getRun`
- Web UI: new run page — checkboxes for models/criteria, prompt input, requestsPerModel, execute button
- TUI: run menu — same flow with keyboard navigation
- Error handling: per-response errors are non-blocking (stored, shown in results)

### Stage 4 — Scoring (planned)
- DB schema: ScoringSessions + Scores tables
- Core: `createScoringSession`, `scoreResponse`, `getSessionScores`
- Responses presented in random shuffled order (blind scoring)
- Web + TUI: score each response per criterion; progress indicator
- Allow re-scoring: creates a new ScoringSession for the same run

### Stage 5 — Results & Export (planned)
- Core: `computeResults(runId, sessionId)` — applies scoring formula, returns ranked list
- Web + TUI: results page
  - Ranked list with collapsible per-criterion breakdown
  - Detail table (response × criterion × score), sortable + filterable per column
  - Export: JSON / CSV / PDF
- History: list all past runs; open any run's results; start re-score from history

---

## Security Requirements

- API keys: AES-256-GCM encrypted before DB write; master key in OS keychain (keytar)
- No plaintext secrets in source, logs, or export files
- `.env` excluded from git
- Access: localhost only, no authentication

## Key Constraints

- **Offline-first**: works without internet (model API calls are the only external dependency)
- **Blind scoring**: response order is shuffled; model identity hidden during scoring
- **Feature parity**: every Web feature must exist in TUI and vice versa
- **Re-scoring**: multiple scoring sessions per run must be supported
- **Strict TypeScript**: no `any`, strict mode in all workspaces
- **Adapter pattern**: new model provider = new file in `core/adapters/` only
- **UI**: Web — responsive, dark theme (Tailwind); TUI — keyboard navigation
- **Native modules**: `better-sqlite3` and `keytar` in `serverExternalPackages` in `next.config.ts`
- **CI**: `libsecret-1-dev` required on Ubuntu for keytar
