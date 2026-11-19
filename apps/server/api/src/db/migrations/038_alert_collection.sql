-- Alert collection — the Server collects every alert source once and keeps its state
-- (apps/server/docs/design/alert-collection.md).
--
--   alert_state         the state now: one row per source × alert id (its current or latest
--                       occurrence). Open rows stay; resolved ones are kept 24 h.
--   alert_source_state  how collecting each source goes: ok, failing (its alerts are frozen,
--                       never resolved), never (not collected yet), off.
--
-- alert_events (024) stays the history of transitions. The rows in it so far were written
-- only as a side effect of signed-in viewing and never recorded a resolution, so they go.

CREATE TABLE IF NOT EXISTS alert_state (
  source_id     TEXT NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  alert_key     TEXT NOT NULL,            -- Alert.id
  occurrence    INTEGER NOT NULL DEFAULT 1,
  group_key     TEXT NOT NULL,            -- what repeats of one problem share (host + title)
  status        TEXT NOT NULL,            -- 'active' | 'resolved'
  severity      TEXT NOT NULL,
  started_at    INTEGER NOT NULL,         -- when the source says it started (ms)
  resolved_at   INTEGER,
  resolved_by   TEXT,                     -- 'source' | 'absent'
  first_seen_at INTEGER NOT NULL,         -- when Shumoku first saw it
  last_seen_at  INTEGER NOT NULL,         -- last answer it was in (written on change only)
  alert_json    TEXT NOT NULL,            -- the Alert as the plugin gave it
  PRIMARY KEY (source_id, alert_key)
);
CREATE INDEX IF NOT EXISTS idx_alert_state_open ON alert_state (source_id, status);

CREATE TABLE IF NOT EXISTS alert_source_state (
  source_id       TEXT PRIMARY KEY REFERENCES data_sources(id) ON DELETE CASCADE,
  state           TEXT NOT NULL,          -- 'ok' | 'failing' | 'never' | 'off'
  last_success_at INTEGER,
  last_attempt_at INTEGER,
  last_error      TEXT,
  fail_count      INTEGER NOT NULL DEFAULT 0
);

DELETE FROM alert_events;
ALTER TABLE alert_events ADD COLUMN occurrence INTEGER NOT NULL DEFAULT 1;
