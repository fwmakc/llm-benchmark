# LLM Benchmark

Monorepo for LLM benchmarking tools: a web interface and a terminal UI.

## Structure

```
llm-benchmark/
├── apps/
│   ├── web/          # Next.js web application
│   └── tui/          # Ink terminal UI
├── packages/
│   └── core/         # Shared utilities and types
├── .github/
│   └── workflows/
│       └── ci.yml    # GitHub Actions CI
└── package.json      # Workspace root
```

## Prerequisites

- Node.js 20+
- npm 10+

## Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd llm-benchmark

# Install all dependencies
npm install
```

## Running

### Web (Next.js)

```bash
npm run dev:web
```

Opens at [http://localhost:3000](http://localhost:3000)

### TUI (Ink terminal app)

```bash
npm run dev:tui
```

## Building

```bash
# Build all packages
npm run build
```

## Linting & Formatting

```bash
# Lint all workspaces
npm run lint

# Format all files
npm run format

# Type-check all workspaces
npm run type-check
```

## CI

GitHub Actions runs on every push and pull request to `main`:

- Type checking
- ESLint
- Build

See [.github/workflows/ci.yml](.github/workflows/ci.yml).
