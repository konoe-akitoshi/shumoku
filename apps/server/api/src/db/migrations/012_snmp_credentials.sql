-- SNMP credentials — first-class named credential entities.
--
-- Why this is its own table (not just a field on data_sources): one
-- network typically has multiple SNMP communities ("core switches"
-- vs "default read-only" vs an acquisition's leftover private string).
-- Today operators handle this by creating one SNMP-LLDP data source
-- per community — workable, but the "data source" abstraction starts
-- to mean nothing once it's per-credential. Lift credential to its
-- own entity, let nodes/subgraphs/topology-default reference one via
-- the existing DiscoveryPolicy inheritance chain.
--
-- Mirrors Scanopy's design: "credential" is named, reusable, bound at
-- network-default or per-host level.
--
-- Storage: community held in plain text in SQLite (consistent with
-- how `data_sources.config_json` carries `token`/`password`/etc.).
-- API responses mask it via the same SECRET_KEYS pattern. True
-- at-rest encryption is a separate hardening item, tracked apart.

CREATE TABLE IF NOT EXISTS snmp_credentials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  -- v2c only for now; v3 (auth/priv/securityname) lands when the
  -- plugin grows v3 support. Stored as a literal string.
  community TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snmp_credentials_name ON snmp_credentials(name);
