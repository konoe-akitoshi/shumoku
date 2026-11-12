---
'@shumoku/core': patch
---

`resolveNetwork` clusters sources in priority order, so the highest-priority source's view decides
how devices cluster regardless of the order the snapshots are listed in.
