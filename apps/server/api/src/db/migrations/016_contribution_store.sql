-- Stage 1 of the DB-native persistence refactor (db-native-persistence.md):
-- the uniform contribution store. New tables only — nothing reads them yet; the
-- codec (ingestGraph/buildGraph) + resolve integration land in later steps.
--
-- A topology = N contributions, each a contribution_source row. attachment_id set =
-- external feed (owned by its topology_data_sources attach row); attachment_id NULL =
-- the project's own intrinsic contribution. No human/authored concept.

-- Candidate key on topology_data_sources so contribution_source can FK (attachment_id, topology_id).
CREATE UNIQUE INDEX IF NOT EXISTS idx_tds_id_topology ON topology_data_sources(id, topology_id);

CREATE TABLE IF NOT EXISTS contribution_source (
  topology_id TEXT NOT NULL REFERENCES topologies(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  attachment_id TEXT,
  last_status TEXT,
  last_ok_at INTEGER,
  graph_payload_json TEXT,
  PRIMARY KEY (topology_id, source_id),
  FOREIGN KEY (attachment_id, topology_id) REFERENCES topology_data_sources(id, topology_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contrib_one_per_attach ON contribution_source(attachment_id) WHERE attachment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_contrib_one_intrinsic ON contribution_source(topology_id) WHERE attachment_id IS NULL;

CREATE TABLE IF NOT EXISTS contribution_element (
  id INTEGER PRIMARY KEY,
  topology_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  local_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('node', 'port', 'subgraph', 'termination')),
  parent_local_id TEXT,
  presence TEXT CHECK (presence IN ('present', 'hide')),
  payload_json TEXT,
  FOREIGN KEY (topology_id, source_id) REFERENCES contribution_source(topology_id, source_id) ON DELETE CASCADE,
  FOREIGN KEY (topology_id, source_id, parent_local_id) REFERENCES contribution_element(topology_id, source_id, local_id),
  UNIQUE (topology_id, source_id, local_id),
  UNIQUE (id, topology_id, source_id)
);
CREATE INDEX IF NOT EXISTS idx_contrib_element_src ON contribution_element(topology_id, source_id);

CREATE TABLE IF NOT EXISTS contribution_identity (
  element_id INTEGER NOT NULL,
  topology_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  key_type TEXT NOT NULL,
  key_value TEXT NOT NULL,
  PRIMARY KEY (element_id, key_type, key_value),
  FOREIGN KEY (element_id, topology_id, source_id) REFERENCES contribution_element(id, topology_id, source_id) ON DELETE CASCADE
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_contrib_identity_match ON contribution_identity(topology_id, key_type, key_value);

CREATE TABLE IF NOT EXISTS contribution_link (
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
CREATE INDEX IF NOT EXISTS idx_contrib_link_src ON contribution_link(topology_id, source_id);

CREATE TABLE IF NOT EXISTS contribution_link_via (
  link_id INTEGER NOT NULL REFERENCES contribution_link(id) ON DELETE CASCADE,
  topology_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  termination_local_id TEXT NOT NULL,
  PRIMARY KEY (link_id, seq),
  FOREIGN KEY (topology_id, source_id, termination_local_id) REFERENCES contribution_element(topology_id, source_id, local_id)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS contribution_attachment (
  id INTEGER PRIMARY KEY,
  topology_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  element_id INTEGER,
  scope TEXT NOT NULL CHECK (scope IN ('node', 'port', 'subgraph', 'topology-default')),
  kind TEXT NOT NULL CHECK (kind IN ('access', 'policy', 'metrics-binding')),
  attachment_key TEXT NOT NULL,
  target_source_id TEXT REFERENCES data_sources(id) ON DELETE CASCADE,
  negate INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT,
  CHECK ((scope = 'topology-default') = (element_id IS NULL)),
  CHECK (kind != 'metrics-binding' OR negate = 1 OR target_source_id IS NOT NULL),
  FOREIGN KEY (topology_id, source_id) REFERENCES contribution_source(topology_id, source_id) ON DELETE CASCADE,
  FOREIGN KEY (element_id, topology_id, source_id) REFERENCES contribution_element(id, topology_id, source_id) ON DELETE CASCADE,
  UNIQUE (topology_id, source_id, element_id, attachment_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contrib_attach_default
  ON contribution_attachment(topology_id, source_id, attachment_key) WHERE element_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_contrib_attach_kind ON contribution_attachment(topology_id, kind);
CREATE INDEX IF NOT EXISTS idx_contrib_attach_target ON contribution_attachment(target_source_id);
