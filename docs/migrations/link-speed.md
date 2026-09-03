# Link speed migration

PR #688 removes `Link.rateBps` and uses `Link.speedBps` for nominal link capacity.
This is a breaking data/API change, not a change to live throughput metrics.
There is no runtime compatibility alias or automatic persisted-data migration.

## Before merging or deploying

1. Identify producers and saved graphs that still use `links[].rateBps`, including
   Manual observations, JSON exports, Editor project files and custom API clients.
   Back up affected data before replacing it. Do not blindly replace similarly
   named fields inside arbitrary metadata or live metrics.
2. Update custom producers to emit `speedBps` in bits per second. The bundled
   NetBox, Huawei NCE and Arista CV-CUE producers are updated in this PR.
3. For Manual/imported JSON graphs, rename each link's `rateBps` key to `speedBps`
   without changing its numeric value. If both keys exist and disagree, resolve
   the conflict explicitly rather than overwriting either value automatically.
   In authorable YAML, use `speed: 10G` or `speedBps: 10000000000`.
4. Plan a fresh synchronization for discovery-backed sources after deployment.
   Failed/offline sources retain their old observations; merely deploying code
   does not migrate those observations. Manual graphs must be re-saved/re-pushed
   explicitly after conversion; they cannot be repaired by an upstream rescan.
5. Verify link widths, utilization denominators and layout/trunk classification
   with representative data after migration. Preserve the original backup for
   rollback with the previous code version.

Until migrated or refreshed, an old `rateBps` value is ignored. Links without an
explicit Ethernet standard can therefore lose their speed-derived width or
trunk classification. A declared endpoint standard continues to take priority
over `speedBps`. Legacy YAML keys are reported as errors; JSON is not an automatic
conversion path.

The PR must not be merged solely because CI is green: the affected saved-data
inventory and the rollout/migration owner must be confirmed first. No production
data is modified by this document or by the tests.
