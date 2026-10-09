---
'@shumoku/core': major
'shumoku-plugin-netbox': patch
---

Remove the unused `Node.rank` field from the topology model, YAML authoring types, and observation resolution. YAML input and serialization reject the removed field instead of retaining a layout hint that has no effect. Remove `rank` from existing topology data before using these APIs. Layout engines continue to compute their own internal depth values.

NetBox conversion and YAML export no longer emit `rank` on nodes. Tag levels continue to serve the converter's existing sorting and endpoint-ordering behavior.
