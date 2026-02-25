export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS Models (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  provider    TEXT NOT NULL,
  model_id    TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  temperature REAL,
  max_tokens  INTEGER,
  base_url    TEXT
);

CREATE TABLE IF NOT EXISTS Criteria (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  max_score   REAL NOT NULL DEFAULT 10,
  weight      REAL NOT NULL DEFAULT 1.0,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS Runs (
  id                  TEXT PRIMARY KEY,
  prompt              TEXT NOT NULL,
  requests_per_model  INTEGER NOT NULL,
  created_at          INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS RunModels (
  run_id    TEXT NOT NULL REFERENCES Runs(id) ON DELETE CASCADE,
  model_id  TEXT NOT NULL REFERENCES Models(id) ON DELETE CASCADE,
  PRIMARY KEY (run_id, model_id)
);

CREATE TABLE IF NOT EXISTS RunCriteria (
  run_id      TEXT NOT NULL REFERENCES Runs(id) ON DELETE CASCADE,
  criteria_id TEXT NOT NULL REFERENCES Criteria(id) ON DELETE CASCADE,
  PRIMARY KEY (run_id, criteria_id)
);

CREATE TABLE IF NOT EXISTS Responses (
  id          TEXT PRIMARY KEY,
  run_id      TEXT NOT NULL REFERENCES Runs(id) ON DELETE CASCADE,
  model_id    TEXT NOT NULL REFERENCES Models(id) ON DELETE CASCADE,
  content     TEXT,
  tokens_used INTEGER,
  latency_ms  INTEGER,
  error_msg   TEXT,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS Scores (
  id            TEXT PRIMARY KEY,
  response_id   TEXT NOT NULL REFERENCES Responses(id) ON DELETE CASCADE,
  criterion_id  TEXT NOT NULL REFERENCES Criteria(id) ON DELETE CASCADE,
  score         REAL NOT NULL,
  notes         TEXT,
  created_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_run_models_run      ON RunModels(run_id);
CREATE INDEX IF NOT EXISTS idx_run_criteria_run    ON RunCriteria(run_id);
CREATE INDEX IF NOT EXISTS idx_responses_run       ON Responses(run_id);
CREATE INDEX IF NOT EXISTS idx_responses_model     ON Responses(model_id);
CREATE INDEX IF NOT EXISTS idx_scores_response     ON Scores(response_id);
CREATE INDEX IF NOT EXISTS idx_scores_criterion    ON Scores(criterion_id);
`;
