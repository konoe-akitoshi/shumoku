-- A data source's own polling intervals, overriding the server-wide defaults that the Settings
-- page keeps (`settings`: polling.alertsMs / polling.metricsMs). JSON
-- {"alertsMs"?: number, "metricsMs"?: number}; NULL: the defaults. alertsMs 0: not collected.
ALTER TABLE data_sources ADD COLUMN polling_json TEXT;
