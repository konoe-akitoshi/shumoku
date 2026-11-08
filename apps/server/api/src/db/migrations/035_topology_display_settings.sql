-- Migration 035: the display setting that used to live in the hidden project overlay
-- moves onto the topology row, and the overlay's one-per-topology index goes.
--
--   hide_disconnected: 1 hides nodes that no link reaches (applied after the merge).
--
-- Copying an existing overlay's setting and removing the overlay itself happen at
-- startup (`removeProjectOverlays`), after the metrics-mapping backfill, because that
-- backfill still reads bindings from the overlay of a pre-0.3 database.
ALTER TABLE topologies ADD COLUMN hide_disconnected INTEGER NOT NULL DEFAULT 0;

-- Nothing writes a contribution without an owning attachment any more.
DROP INDEX IF EXISTS idx_contrib_one_intrinsic;
