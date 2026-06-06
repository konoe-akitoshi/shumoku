-- Phase 4 (composition store): drop the legacy single-source pointers on
-- `topologies`. The many-to-many `topology_data_sources` table (purpose =
-- 'topology' | 'metrics') has been the real model since migration 003; these
-- columns were a parallel, vestigial source of truth. No data migration is
-- needed — the m2m table already holds every attachment.
--
-- See apps/server/docs/design/topology-composition-store.md § Phase 4.

DROP INDEX IF EXISTS idx_topologies_topology_source;
DROP INDEX IF EXISTS idx_topologies_metrics_source;

ALTER TABLE topologies DROP COLUMN topology_source_id;
ALTER TABLE topologies DROP COLUMN metrics_source_id;
