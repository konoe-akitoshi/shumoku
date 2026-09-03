-- Attach an authenticated subject and claims to every session. Existing
-- single-administrator sessions become local-admin sessions automatically.
ALTER TABLE sessions ADD COLUMN subject TEXT NOT NULL DEFAULT 'local-admin';
ALTER TABLE sessions ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'
  CHECK (role IN ('viewer', 'user', 'admin'));
ALTER TABLE sessions ADD COLUMN auth_method TEXT NOT NULL DEFAULT 'password'
  CHECK (auth_method IN ('password', 'bearer'));

CREATE INDEX IF NOT EXISTS idx_sessions_subject ON sessions(subject);
