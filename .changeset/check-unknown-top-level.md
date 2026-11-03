---
'@shumoku/core': patch
---

Fix `checkNetwork` (and so `readNetworkModel`) throwing `ReferenceError` on a network with an unknown top-level field, such as an old-format `settings:` or `subgraphs:`; the field is now reported in the issue list.
