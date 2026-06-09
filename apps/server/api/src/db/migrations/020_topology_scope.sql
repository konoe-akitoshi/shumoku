-- Topology-level scope (composition-modes.md follow-up).
--
-- Scope is a SINGLE per-topology decision — "which region set closes the world" —
-- not a per-source property. It moves off the per-source `scope_role` flag onto
-- the topology row. Per-source contribution (node/link) stays per-attach, because
-- "how THIS source behaves in THIS topology" is genuinely per (topology × source).
--
--   scope_mode:      'auto'   — the highest-priority topology source's regions are
--                              the closed world (default; reproduces prior behavior)
--                    'open'   — no scoping; pure union of all sources
--                    'closed' — scope_source_id's regions are the closed world
--   scope_source_id: the scoping source (data_sources.id) when scope_mode='closed'
--
-- No backcompat (server schema policy): scope_role is dropped. Existing topologies
-- default to 'auto', which is what the old "top source defines scope" derivation did.
ALTER TABLE topologies ADD COLUMN scope_mode TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE topologies ADD COLUMN scope_source_id TEXT;
ALTER TABLE topology_data_sources DROP COLUMN scope_role;
