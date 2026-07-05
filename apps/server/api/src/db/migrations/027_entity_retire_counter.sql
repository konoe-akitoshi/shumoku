-- Phase 4: Entity lifecycle — retire counter.
-- Tracks consecutive miss counts per (topology, source, entity) so
-- retireStaleEntities() can retire an entity after RETIRE_THRESHOLD_SYNCS
-- consecutive absences from a source that DID return data.
-- entity_id cascades on entity_registry delete so reset/merge clean it up.

CREATE TABLE IF NOT EXISTS entity_retire_counter (
  topology_id TEXT NOT NULL,
  source_id   TEXT NOT NULL,
  entity_id   TEXT NOT NULL REFERENCES entity_registry(id) ON DELETE CASCADE,
  miss_count  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (topology_id, source_id, entity_id)
);
