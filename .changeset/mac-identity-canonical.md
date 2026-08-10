---
'@shumoku/core': patch
---

fix(core): canonicalise MAC-shaped identity keys so the same device merges across sources

`buildIdentity` stored `mac` and `chassisId` exactly as the plugin spelled them, and
identity matching compares key values as exact strings. Sources disagree on spelling for
the same wire address — Huawei NCE returns `50-04-01-01-D5-50` in its device list and
`CC:D8:1F:9F:D4:AB` in its LLDP table, an SNMP walk of that same switch yields
`cc:d8:1f:9f:d4:ab`, Cisco gear writes `ccd8.1f9f.d4ab` — so one device arrived as two
entities that never merged, silently. Both keys are now lowercased and colon-separated
via the new `normalizeMacKey`, which also pads the unpadded octets BSD `arp` prints
(`0:d:5d:11:f0:73`). Values that are neither twelve hex digits once separators are
stripped nor six 1–2 digit groups are left untouched, since `chassisId` is only
sometimes a MAC.
