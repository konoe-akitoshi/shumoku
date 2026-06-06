-- Phase 4 (composition store): drop the legacy single-source pointers on
-- `topologies`. The many-to-many `topology_data_sources` table (purpose =
-- 'topology' | 'metrics') is the real model since migration 003.
--
-- BUT migration 003 never backfilled the legacy columns into the m2m table, so a
-- DB whose source was only ever set via the legacy column has nothing in the m2m.
-- Backfill those rows FIRST (idempotent: derived id + INSERT OR IGNORE against
-- UNIQUE(topology_id, data_source_id, purpose)), THEN drop the columns — else
-- the pointer is lost and the metrics-binding backfill that runs next can't find
-- the metrics source and would drop mapping_json with the mapping unmigrated.
--
-- See apps/server/docs/design/topology-composition-store.md § Phase 4.

INSERT OR IGNORE INTO topology_data_sources
  (id, topology_id, data_source_id, purpose, sync_mode, created_at, updated_at)
SELECT 'tds_topo_' || id, id, topology_source_id, 'topology', 'manual', created_at, updated_at
FROM topologies
WHERE topology_source_id IS NOT NULL;

INSERT OR IGNORE INTO topology_data_sources
  (id, topology_id, data_source_id, purpose, sync_mode, created_at, updated_at)
SELECT 'tds_metrics_' || id, id, metrics_source_id, 'metrics', 'manual', created_at, updated_at
FROM topologies
WHERE metrics_source_id IS NOT NULL;

DROP INDEX IF EXISTS idx_topologies_topology_source;
DROP INDEX IF EXISTS idx_topologies_metrics_source;

ALTER TABLE topologies DROP COLUMN topology_source_id;
ALTER TABLE topologies DROP COLUMN metrics_source_id;
