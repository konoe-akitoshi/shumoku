---
'@shumoku/core': patch
---

`resolveNetwork` carries the registry entity of each merged node and port out of the merge (`NodeObservation.entityId`, `PortObservation.entityId`), and takes the project's own entities (`ResolveOptions.projectEntities`), so a caller keyed on entities reads the merge's answer instead of looking the node up again.
