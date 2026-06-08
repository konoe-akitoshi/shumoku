-- Heal a dev-DB schema drift: contribution_link.local_id must be NULLABLE.
--
-- A link's identity is its endpoints, not its id (see core Link type) — id is an
-- optional passthrough, so id-less links from a source store local_id = NULL.
-- Migration 016 declares `local_id TEXT` (nullable) and always has in committed
-- history. But some dev DBs created the table with `local_id TEXT NOT NULL` from
-- an in-place edit of 016 before it was committed; CREATE TABLE IF NOT EXISTS
-- never recreated it, so those DBs reject id-less links ("NOT NULL constraint
-- failed: contribution_link.local_id") — e.g. a TTDB source that omits link ids.
--
-- SQLite can't drop a column constraint in place, so rebuild the table to the
-- canonical 016 shape, preserving rows. Idempotent / safe on already-correct DBs
-- (it just rebuilds to an identical schema).
PRAGMA foreign_keys=OFF;

DROP TABLE IF EXISTS contribution_link__new;

CREATE TABLE contribution_link__new (
  id INTEGER PRIMARY KEY,
  topology_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  local_id TEXT,
  from_node_local_id TEXT NOT NULL,
  from_port_local_id TEXT,
  to_node_local_id TEXT NOT NULL,
  to_port_local_id TEXT,
  presence TEXT CHECK (presence IN ('present', 'hide')),
  payload_json TEXT,
  FOREIGN KEY (topology_id, source_id) REFERENCES contribution_source(topology_id, source_id) ON DELETE CASCADE,
  FOREIGN KEY (topology_id, source_id, from_node_local_id) REFERENCES contribution_element(topology_id, source_id, local_id),
  FOREIGN KEY (topology_id, source_id, to_node_local_id) REFERENCES contribution_element(topology_id, source_id, local_id),
  FOREIGN KEY (topology_id, source_id, from_port_local_id) REFERENCES contribution_element(topology_id, source_id, local_id),
  FOREIGN KEY (topology_id, source_id, to_port_local_id) REFERENCES contribution_element(topology_id, source_id, local_id),
  UNIQUE (topology_id, source_id, local_id)
);

INSERT INTO contribution_link__new
  SELECT id, topology_id, source_id, local_id, from_node_local_id, from_port_local_id,
         to_node_local_id, to_port_local_id, presence, payload_json
  FROM contribution_link;

DROP TABLE contribution_link;

ALTER TABLE contribution_link__new RENAME TO contribution_link;

CREATE INDEX IF NOT EXISTS idx_contrib_link_src ON contribution_link(topology_id, source_id);

PRAGMA foreign_keys=ON;
