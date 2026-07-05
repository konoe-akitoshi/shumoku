-- Phase 1: Entity Registry (topology-foundation-entity-registry.md §2.1)
-- Stable entity IDs minted at ingest time, surviving re-scans and cross-source adoption.
-- Three tables:
--   entity_registry      — one row per logical entity (node / port / link)
--   entity_identity_key  — identity keys associated with each entity
--   entity_alias         — merge tombstones (absorbed old_id → survivor new_id)
--
-- Design note: entity_identity_key.parent_id uses '' (empty string, NOT NULL) for
-- node and link entities to satisfy UNIQUE constraints under SQLite's
-- NULL-is-distinct semantics.  Port entities use the parent node entity id.

CREATE TABLE IF NOT EXISTS entity_registry (
  id            TEXT PRIMARY KEY,
  topology_id   TEXT NOT NULL
                REFERENCES topologies(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL
                CHECK (kind IN ('node', 'port', 'link')),
  parent_id     TEXT
                REFERENCES entity_registry(id),
  status        TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'retired')),
  first_seen_at INTEGER NOT NULL,
  last_seen_at  INTEGER NOT NULL,
  retired_at    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_entity_registry_topology
  ON entity_registry(topology_id, kind);

CREATE TABLE IF NOT EXISTS entity_identity_key (
  topology_id TEXT NOT NULL,
  entity_id   TEXT NOT NULL REFERENCES entity_registry(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  parent_id   TEXT NOT NULL DEFAULT '',
  key         TEXT NOT NULL,
  value       TEXT NOT NULL,
  UNIQUE (topology_id, kind, parent_id, key, value)
);

CREATE INDEX IF NOT EXISTS idx_entity_identity_lookup
  ON entity_identity_key(topology_id, kind, parent_id, key, value);

CREATE TABLE IF NOT EXISTS entity_alias (
  old_id TEXT PRIMARY KEY
         REFERENCES entity_registry(id) ON DELETE CASCADE,
  new_id TEXT NOT NULL
         REFERENCES entity_registry(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_entity_alias_new
  ON entity_alias(new_id);
