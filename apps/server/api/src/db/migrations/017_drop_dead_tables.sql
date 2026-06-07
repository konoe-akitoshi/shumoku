-- Stage 0 cleanup: drop dead tables left in long-lived dev DBs by deleted migrations.
-- `manual_source_graph` and `snmp_credentials` are created by no current migration and
-- have zero code references; a fresh DB never has them. DROP IF EXISTS is a no-op on
-- fresh DBs and a structural cleanup on existing ones.
DROP TABLE IF EXISTS manual_source_graph;
DROP TABLE IF EXISTS snmp_credentials;
