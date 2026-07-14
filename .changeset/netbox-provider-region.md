---
'shumoku-plugin-netbox': patch
---

**netbox**: place synthesized provider boundary nodes in an "Upstream" region so
they survive scoped resolution. A parentless node is dropped under the deployed
default `scope_mode: auto` (which closes the world to the topology source's
regions and drops any node outside one), so upstream provider nodes and their
uplink links vanished on a real deployment even though they rendered fine under
`open` scope. The provider node now parents into a source-emitted `upstream`
subgraph, making it a member of a closed region — and grouping upstream
providers together, matching how a physical diagram draws them.
