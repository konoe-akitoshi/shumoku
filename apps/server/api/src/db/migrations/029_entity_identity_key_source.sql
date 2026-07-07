-- Migration 029: add source_id to entity_identity_key for per-source singleton-key replacement.
--
-- SINGLETON keys (mgmtIp, sysName per node; ifIndex per port) are now stored with
-- the source that reported them. When a source reports a new value for a singleton
-- key, old rows for (entity, key, source) with a different value are deleted and
-- the new (key, value, source) row is inserted. Other sources' rows are unaffected.
--
-- Backward compatibility: existing rows receive source_id = '' (the legacy sentinel,
-- treated as "unknown source" — never replaced by per-source replacement logic,
-- which only fires when source_id != '').
--
-- The UNIQUE constraint changes from (topology_id, kind, parent_id, key, value)
-- to (topology_id, kind, parent_id, key, value, source_id) so a value can appear
-- from multiple independent sources while still being idempotent per source.

ALTER TABLE entity_identity_key ADD COLUMN source_id TEXT NOT NULL DEFAULT '';

DROP INDEX IF EXISTS entity_identity_key_unique;

CREATE UNIQUE INDEX IF NOT EXISTS entity_identity_key_unique
  ON entity_identity_key(topology_id, kind, parent_id, key, value, source_id);

CREATE INDEX IF NOT EXISTS idx_entity_identity_source
  ON entity_identity_key(topology_id, entity_id, key, source_id);
