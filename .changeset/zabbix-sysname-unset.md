---
'shumoku-plugin-zabbix': patch
---

Leave `identity.sysName` unset unless `inventory.name` supplies it. The plugin used to fall back to `host.name`, an operator display string, which made a host read by both Zabbix and SNMP fail to merge when the two names differed.
