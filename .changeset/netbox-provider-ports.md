---
'shumoku-plugin-netbox': patch
---

**netbox**: synthesized provider boundary nodes now expose one handoff port per
circuit landing on them, and circuit links reference that port. Previously the
provider side of an uplink was a portless endpoint (`port: ''`), so two uplinks
to the same provider converged on the bare node — violating the LinkEndpoint
contract ("must reference an existing port") and the 1-port-=-1-link invariant.
Port id = the circuit's `cid` (stable across rescans; `ifName` defaults to it
on ingest, satisfying the identity contract).
