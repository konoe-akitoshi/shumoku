---
"@shumoku/core": patch
---

Give `NetworkModel`'s layers what the older graph carried: a node's ports split by layer (`PortObservation`, `PortDesign`, `PortDrawing`) and keyed by port name, the plug at each end of a link and its cable product, a node's icon, a group's spec, and the fields a source keeps as it found them.
