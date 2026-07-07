-- Migration 029: add source_id to entity_identity_key for per-source singleton-key
-- replacement (#570).
--
-- SINGLETON keys (mgmtIp, sysName per node; ifIndex per port) are now stored with
-- the source that reported them. When a source reports a new value for a singleton
-- key, old rows for (entity, key) from that same source — or from the legacy ''
-- sentinel — with a different value are deleted and the new (key, value, source)
-- row is inserted. Other sources' rows are unaffected, so dual-homed multi-source
-- truth survives while a single source's stale value (the "IP magnet") does not.
--
-- Uniqueness changes from (topology_id, kind, parent_id, key, value) to
-- (topology_id, kind, parent_id, key, value, source_id):
--   * entity_id is deliberately NOT part of the unique key — a given (key, value)
--     from a given source must resolve to exactly ONE entity, which is what makes
--     adopt-or-mint lookup deterministic. Two entities disagreeing about who owns
--     a value is only representable across different sources (and is then resolved
--     by the staged-lookup veto / merge-guard rules).
--   * source_id IS part of the unique key so two sources can independently assert
--     the same value (e.g. both see mgmtIp 10.0.0.1) without clobbering each other.
--
-- The original uniqueness was declared as an inline table constraint (migration
-- 025), which SQLite enforces via an undroppable sqlite_autoindex — so the table
-- must be rebuilt (create-new / copy / drop / rename, same idiom as migration 028).
-- Existing rows receive source_id = '' (the legacy "unknown source" sentinel).

CREATE TABLE entity_identity_key_new (
  topology_id TEXT NOT NULL,
  entity_id   TEXT NOT NULL REFERENCES entity_registry(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  parent_id   TEXT NOT NULL DEFAULT '',
  key         TEXT NOT NULL,
  value       TEXT NOT NULL,
  source_id   TEXT NOT NULL DEFAULT '',
  UNIQUE (topology_id, kind, parent_id, key, value, source_id)
);

INSERT INTO entity_identity_key_new (topology_id, entity_id, kind, parent_id, key, value)
  SELECT topology_id, entity_id, kind, parent_id, key, value
  FROM entity_identity_key;

DROP TABLE entity_identity_key;

ALTER TABLE entity_identity_key_new RENAME TO entity_identity_key;

CREATE INDEX IF NOT EXISTS idx_entity_identity_lookup
  ON entity_identity_key(topology_id, kind, parent_id, key, value);

CREATE INDEX IF NOT EXISTS idx_entity_identity_source
  ON entity_identity_key(topology_id, entity_id, key, source_id);
