-- Device access — how Shumoku reaches a device to read it directly.
--
-- Replaces `deep_read_config` (one community string per node, plus a scheduler
-- mode / interval that nothing but `disabled` ever honoured). Three tables:
--
--   credential           a named, server-wide credential for one access method
--                        ('snmp' today). A community is a fact about the
--                        network, not about one diagram, so it is stored once
--                        and rotated once. Non-secret and secret parameters
--                        live in separate columns so listings never touch the
--                        secret.
--   topology_credential  which topologies USE which credential. A credential
--                        is only ever tried on a topology that links it: one
--                        server may host separate networks, and one site's
--                        community must not be sprayed at another's devices.
--   device_access        one row per node entity: which credential reads it,
--                        whether it is read at all, and how the last read went.
--
-- No inheritance chain and no topology default: a device either references a
-- credential or it does not. The method-specific parameters are data (JSON,
-- shaped by the method's field list in code), so a new access method needs no
-- schema change.

CREATE TABLE IF NOT EXISTS credential (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL UNIQUE,
  method            TEXT NOT NULL,
  -- Non-secret method parameters, e.g. {} for SNMP v2c.
  params_json       TEXT NOT NULL,
  -- Secret method parameters only, e.g. {"community":"..."}. Plaintext for now;
  -- encryption at rest is a separate, later change. Never selected by listings.
  secret_json       TEXT NOT NULL,
  -- The "credentials changed" clock: moves on creation and on any parameter or
  -- secret VALUE change, not on a rename. It decides when a device that
  -- answered none of the credentials is worth trying again.
  secret_changed_at INTEGER NOT NULL,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS topology_credential (
  topology_id   TEXT NOT NULL
                REFERENCES topologies(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL
                REFERENCES credential(id) ON DELETE CASCADE,
  -- Adding a link moves the topology's retry clock; removing one does not.
  added_at      INTEGER NOT NULL,
  PRIMARY KEY (topology_id, credential_id)
);

CREATE INDEX IF NOT EXISTS idx_topology_credential_credential
  ON topology_credential(credential_id);

CREATE TABLE IF NOT EXISTS device_access (
  entity_id     TEXT PRIMARY KEY
                REFERENCES entity_registry(id) ON DELETE CASCADE,
  topology_id   TEXT NOT NULL
                REFERENCES topologies(id) ON DELETE CASCADE,
  -- NULL = no credential: the device is not read. Deleting a credential
  -- un-assigns it from every device that used it.
  credential_id TEXT
                REFERENCES credential(id) ON DELETE SET NULL,
  enabled       INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  -- Outcome of the last read of this device.
  last_read_at  INTEGER,
  last_status   TEXT CHECK (last_status IS NULL OR last_status IN ('ok', 'partial', 'failed')),
  last_error    TEXT,
  -- When every linked credential was tried on this device and none answered.
  tried_at      INTEGER,
  -- Who wrote credential_id: 'probe' when Shumoku found it by trying, NULL when
  -- a person chose it. Kept for audit.
  assigned_by   TEXT,
  updated_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_device_access_topology
  ON device_access(topology_id);
CREATE INDEX IF NOT EXISTS idx_device_access_credential
  ON device_access(credential_id);

-- Carry existing configuration over: one credential per DISTINCT community
-- across all topologies (named by order, never by the secret), linked to every
-- topology that used it, then point each device at it. The only method so far
-- is snmp, whose single field `community` is secret.
INSERT INTO credential (id, name, method, params_json, secret_json, secret_changed_at, created_at, updated_at)
SELECT 'cr_' || lower(hex(randomblob(6))),
       'SNMP ' || row_number() OVER (ORDER BY community),
       'snmp',
       '{}',
       json_object('community', community),
       CAST(strftime('%s', 'now') AS INTEGER) * 1000,
       CAST(strftime('%s', 'now') AS INTEGER) * 1000,
       CAST(strftime('%s', 'now') AS INTEGER) * 1000
  FROM (SELECT DISTINCT community
          FROM deep_read_config
         WHERE community IS NOT NULL AND community != '');

INSERT INTO topology_credential (topology_id, credential_id, added_at)
SELECT DISTINCT d.topology_id, c.id, CAST(strftime('%s', 'now') AS INTEGER) * 1000
  FROM deep_read_config d
  JOIN credential c ON json_extract(c.secret_json, '$.community') = d.community
 WHERE d.community IS NOT NULL AND d.community != '';

INSERT INTO device_access (entity_id, topology_id, credential_id, enabled, updated_at)
SELECT d.entity_id,
       d.topology_id,
       c.id,
       CASE WHEN d.mode = 'disabled' THEN 0 ELSE 1 END,
       d.updated_at
  FROM deep_read_config d
  LEFT JOIN credential c
    ON json_extract(c.secret_json, '$.community') = d.community
 WHERE c.id IS NOT NULL OR d.mode = 'disabled';

DROP TABLE deep_read_config;
