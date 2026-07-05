-- Phase 2: Entity Registry (topology-foundation-entity-registry.md §2.3)
-- The metrics mapping is re-keyed to stable entity ids: a plain row per mapped
-- entity instead of identity-anchored `metrics-binding` attachments folded onto
-- the resolved graph. The HTTP wire shape stays element-keyed; the server
-- translates at the boundary using the entityId-stamped resolved graph.
--
-- One row per mapped entity (a node host binding or a link interface binding).
-- entity_id is the survivor entity id from entity_registry; alias-following on
-- read keeps a pre-merge id resolving to its survivor. payload_json holds the
-- element's NodeMetricsMapping / LinkMetricsMapping verbatim (hostId/hostName,
-- or monitoredNodeId/interface/bandwidth). Rows whose entity is absent from the
-- current resolved graph are surfaced as orphans (GET /:id/mapping/orphans).

CREATE TABLE IF NOT EXISTS metrics_mapping (
  topology_id  TEXT NOT NULL
               REFERENCES topologies(id) ON DELETE CASCADE,
  entity_id    TEXT NOT NULL,
  kind         TEXT NOT NULL
               CHECK (kind IN ('node', 'link')),
  source_id    TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (topology_id, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_metrics_mapping_source
  ON metrics_mapping(topology_id, source_id);
