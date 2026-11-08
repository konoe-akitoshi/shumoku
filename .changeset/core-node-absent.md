---
'@shumoku/core': patch
'@shumoku/cli': patch
---

Add `absent: true` to the input node: a source can say a device is not part of the network, and resolve drops it when the top-priority contribution says so.
