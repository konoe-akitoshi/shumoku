-- Topology-level scope criteria (common ScopeFilter, Phase 2).
--
-- The single, plugin-independent scope of a topology, stored relationally (not as
-- a JSON blob — consistent with the DB-native contribution store). Each row is one
-- include/exclude MembershipCriterion. A topology with no rows = no scope filter
-- (open). This is what every source's plugin-shaped "what to pull" filter folds
-- into; resolve() enforces it post-merge, plugins may push it down (Phase 2b/3).
--
--   kind:  'include' | 'exclude'
--   attr:  'name' | 'subnet' | 'metadata'   (matches MembershipCriterion)
--   key:   metadata key (only when attr='metadata')
--   value: the criterion value
--
-- scope_mode / scope_source_id (020) stay for now; the region-mark scope still
-- governs existing topologies until plugin translation + UI land (Phase 2b/3),
-- so this addition is non-regressing.
CREATE TABLE IF NOT EXISTS topology_scope_criteria (
  id TEXT PRIMARY KEY,
  topology_id TEXT NOT NULL REFERENCES topologies(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  attr TEXT NOT NULL,
  key TEXT,
  value TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scope_criteria_topology ON topology_scope_criteria (topology_id);
