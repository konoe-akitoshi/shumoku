---
"shumoku-plugin-zabbix": patch
---

A traffic item keyed by an SNMP counter and an interface index (`net.if.in[ifHCInOctets.10]`, as Zabbix's own SNMP interface templates key them) now belongs to the interface its name says (`Interface Ethernet10(…): Bits received`), not to an interface called `ifHCInOctets.10`, so links on those ports can be mapped.
