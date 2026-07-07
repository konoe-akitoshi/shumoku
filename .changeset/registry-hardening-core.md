---
'@shumoku/core': patch
---

Add `validateTopologyIdentityContract` to plugin-kit.

Exports a pure helper that checks whether a `NetworkGraph` from a
topology-emitting plugin satisfies the identity contract the entity registry
relies on: every node must carry at least one network identity key
(mgmtIp / chassisId / sysName / vendorIds), and every port that is
link-endpoint-referenced or carries an explicit identity field must have
`identity.ifName` (or rely on the contribution-store's `portIdentityWithIfNameFallback`).

This is the `host-branch-guard`-style guard called for in #569 — a helper +
test assertions, not a framework. In-tree topology plugins (Zabbix, NetBox)
now assert their generated graphs pass the validator in their unit tests.
