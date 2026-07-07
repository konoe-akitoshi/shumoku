-- Migration 030: entity_element — persist registry verdicts per source per element.
--
-- The resolver (resolve() in @shumoku/core) is a pure function that must not
-- query the DB. To make it registry-driven, we write each source's entity
-- assignments into this table at adoptOrMintForGraph() time, then read them
-- back in readObservedSnapshots() and pass them as part of the SnapshotEntry.
--
-- Schema:
--   topology_id  — the topology this belongs to
--   source_id    — the data source that emitted the element
--   kind         — 'node' or 'port' ('link' is derived from port entities)
--   local_id     — node local id (for kind='node'), or
--                  "${nodeLocalId}:${portLocalId}" composite (for kind='port')
--   entity_id    — stable entity id from entity_registry
--
-- Lifecycle: DELETE + INSERT (full replacement) every time adoptOrMintForGraph
-- runs for the same (topology_id, source_id) pair — always reflects the
-- current scan's registry verdict, never accumulates stale rows.

CREATE TABLE IF NOT EXISTS entity_element (
  topology_id TEXT NOT NULL,
  source_id   TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('node', 'port')),
  local_id    TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  PRIMARY KEY (topology_id, source_id, kind, local_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_element_topology_source
  ON entity_element(topology_id, source_id, kind);
