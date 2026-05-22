-- Synthetic 'manual' data source — represents the editor-authored
-- NetworkGraph (formerly the special "authored layer" in `topologies.content_json`).
-- Existing topologies' content_json keeps working: TopologyService now also
-- writes a `topology_observations` row with `source_id = '__manual__'`
-- on every create/update so the resolver can treat Manual as just
-- another source. Sources / Discovery UIs surface this row alongside
-- NetBox / Network Discovery / Zabbix.

INSERT OR IGNORE INTO data_sources (
  id, name, type, config_json, status, fail_count, created_at, updated_at
) VALUES (
  '__manual__',
  'Manual (editor)',
  'manual',
  '{}',
  'connected',
  0,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000,
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
);
