-- Rename the Discovery feature to deep-read, resolving a three-way name
-- clash: "Network Discovery" (the existence-scan plugin), DiscoveryScheduler
-- (plugin re-sync cadence, now SyncScheduler), and the built-in SNMP/LLDP
-- reader — which is the one this table belongs to. The feature is now
-- "deep read" everywhere: table `deep_read_config`, built-in source id
-- 'deep-read'.
--
-- Data under the old 'discovery' source id exists only in dev databases
-- (the feature never shipped); those are migrated in place by hand, not here.

ALTER TABLE discovery_config RENAME TO deep_read_config;
