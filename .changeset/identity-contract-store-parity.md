---
'@shumoku/core': patch
---

validateTopologyIdentityContract now mirrors the server's ingest fallback exactly: a port with an empty identity object is fallback-eligible (ifName = port id), not a violation.
