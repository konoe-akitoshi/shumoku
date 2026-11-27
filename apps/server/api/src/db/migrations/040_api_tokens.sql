-- API tokens: long-lived Bearer credentials an administrator issues for automation
-- (Terraform, CI, scripts). Only the SHA-256 of the secret is stored; the secret is
-- shown once, at creation. `prefix` is the secret's first characters, so a token can
-- be recognised in the list without revealing it.
CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('viewer', 'user', 'admin')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  last_used_at INTEGER
);
