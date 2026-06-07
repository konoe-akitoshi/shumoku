-- Per-source composition modes (topology-source-modes.md, Axis D).
-- Two independent knobs + a scope role on each topology↔source attachment.
-- Defaults reproduce today's behavior (Additive: scoop nodes, add links, no scope),
-- so existing rows are unchanged until the operator opts a source into a role.
--
--   node_contribution: 'scoop'  — assert the source's nodes exist (default)
--                      'anchor' — enrich only; make no node-presence claim
--   link_contribution: 'add'    — assert new links (default)
--                      'update' — only update fields of links others assert
--   scope_role:        NULL     — not scope-defining (default)
--                      'scoping'— this source's regions are a closed world;
--                                 clusters outside them are dropped at resolve.
ALTER TABLE topology_data_sources ADD COLUMN node_contribution TEXT NOT NULL DEFAULT 'scoop';
ALTER TABLE topology_data_sources ADD COLUMN link_contribution TEXT NOT NULL DEFAULT 'add';
ALTER TABLE topology_data_sources ADD COLUMN scope_role TEXT;
