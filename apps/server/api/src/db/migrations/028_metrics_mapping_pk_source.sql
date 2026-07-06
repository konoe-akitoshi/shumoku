-- Fix: metrics_mapping PK must include source_id (#547)
--
-- Previously PRIMARY KEY (topology_id, entity_id) meant a second metrics source
-- writing for the same entity silently destroyed the first source's row via
-- INSERT OR REPLACE. Now each (topology_id, entity_id, source_id) triple is
-- independent, so multiple sources can map the same entity without clobbering
-- each other.
--
-- SQLite does not support ADD CONSTRAINT on existing tables, so we use the
-- create-new / copy / drop / rename idiom to rebuild the table in place.
-- Existing rows are preserved; the source index is recreated on the new table.

CREATE TABLE metrics_mapping_new (
  topology_id  TEXT NOT NULL
               REFERENCES topologies(id) ON DELETE CASCADE,
  entity_id    TEXT NOT NULL,
  kind         TEXT NOT NULL
               CHECK (kind IN ('node', 'link')),
  source_id    TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (topology_id, entity_id, source_id)
);

INSERT INTO metrics_mapping_new
  SELECT topology_id, entity_id, kind, source_id, payload_json, created_at, updated_at
  FROM metrics_mapping;

DROP TABLE metrics_mapping;

ALTER TABLE metrics_mapping_new RENAME TO metrics_mapping;

CREATE INDEX IF NOT EXISTS idx_metrics_mapping_source
  ON metrics_mapping(topology_id, source_id);
