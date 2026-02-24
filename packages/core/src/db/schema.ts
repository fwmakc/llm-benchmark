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
  description TEXT,
  weight      REAL NOT NULL DEFAULT 1.0,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS Runs (
  id          TEXT PRIMARY KEY,
  name        TEXT,
  created_at  INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS Responses (
  id          TEXT PRIMARY KEY,
  run_id      TEXT NOT NULL REFERENCES Runs(id) ON DELETE CASCADE,
  model_id    TEXT NOT NULL REFERENCES Models(id) ON DELETE CASCADE,
  prompt      TEXT NOT NULL,
  response    TEXT,
  created_at  INTEGER NOT NULL,
  latency_ms  INTEGER
);

CREATE TABLE IF NOT EXISTS Scores (
  id            TEXT PRIMARY KEY,
  response_id   TEXT NOT NULL REFERENCES Responses(id) ON DELETE CASCADE,
  criterion_id  TEXT NOT NULL REFERENCES Criteria(id) ON DELETE CASCADE,
  score         REAL NOT NULL,
  notes         TEXT,
  created_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_responses_run    ON Responses(run_id);
CREATE INDEX IF NOT EXISTS idx_responses_model  ON Responses(model_id);
CREATE INDEX IF NOT EXISTS idx_scores_response  ON Scores(response_id);
CREATE INDEX IF NOT EXISTS idx_scores_criterion ON Scores(criterion_id);
`;
