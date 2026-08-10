-- Discovery config — the server-side Discovery feature's OWN storage.
--
-- One row per node entity, cross-referencing the entity registry (the
-- "mainstream" table that enumerates the topology's nodes). This is NOT
-- operator authorship (labels, manual links — those stay on the project
-- overlay) and NOT source observation (contribution store): it is feature
-- configuration for the built-in SNMP/LLDP deep-read. Storing it here —
-- instead of smuggling access/policy attachments into the authored overlay,
-- which forced materializing empty anchor nodes per credential — keeps the
-- three kinds of data in three homes.
--
-- No inheritance, no topology default: a node either has a row (readable,
-- with this credential / mode) or it doesn't. Bulk assignment is a single
-- INSERT...SELECT over entity_registry.

CREATE TABLE IF NOT EXISTS discovery_config (
  entity_id   TEXT PRIMARY KEY
              REFERENCES entity_registry(id) ON DELETE CASCADE,
  topology_id TEXT NOT NULL
              REFERENCES topologies(id) ON DELETE CASCADE,
  -- SNMP v2c community used to deep-read this node. NULL = no credential.
  community   TEXT,
  -- Per-node scheduler mode override. NULL = runtime default ('auto').
  mode        TEXT
              CHECK (mode IS NULL OR mode IN ('auto', 'observe', 'disabled')),
  -- Per-node re-read interval override. NULL = runtime default.
  interval_ms INTEGER,
  updated_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_discovery_config_topology
  ON discovery_config(topology_id);
