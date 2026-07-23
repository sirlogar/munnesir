CREATE TABLE IF NOT EXISTS munnesir_snapshot (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO munnesir_snapshot (id, payload, revision, updated_at)
VALUES (
  'main',
  '{"app":"munnesir","version":"1.0.1","schema":3,"poems":[],"books":[],"deleted":[]}',
  0,
  datetime('now')
);
