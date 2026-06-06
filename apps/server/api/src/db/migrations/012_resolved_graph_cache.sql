-- Phase 3 (composition store): materialize the resolved graph + layout so reads
-- and metrics polls don't re-resolve + re-lay-out every time, and survive a
-- restart / RAM-cache eviction. Invalidation is O(1): a `composition_revision`
-- integer bumped whenever a composition input changes (observation recorded,
-- authored edit, source attach/detach/priority, mapping edit). The artifact
-- stores the revision it was built from; a read compares two integers instead
-- of hashing observation blobs.
--
-- See apps/server/docs/design/topology-composition-store.md § Phase 3.

ALTER TABLE topologies ADD COLUMN composition_revision INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS topology_resolved_graph (
  topology_id          TEXT PRIMARY KEY REFERENCES topologies(id) ON DELETE CASCADE,
  -- Resolved NetworkGraph (identity-merged, attachments folded).
  graph_json           TEXT NOT NULL,
  -- computeNetworkLayout() output: { layout, resolved }.
  layout_json          TEXT,
  -- Resolved icon dimensions (entries of the Map) so a cold read skips the
  -- CDN round-trips.
  icon_dimensions_json TEXT,
  -- topologies.composition_revision this artifact was built from. Stale when it
  -- differs from the current revision.
  built_revision       INTEGER NOT NULL,
  -- Bumped in code when the resolve/layout algorithm changes, so old artifacts
  -- invalidate without a manual purge.
  resolver_version     INTEGER NOT NULL,
  computed_at          INTEGER NOT NULL
);
