---
'@shumoku/core': patch
'@shumoku/renderer': patch
---

The editor edits the model and draws the scene each time; a drag is kept as order hints (`DrawingLayer.order`, `ROOT_FRAME`) instead of coordinates. `drawNetwork` and `drawNetworkScene` accept `hints` (not read by the engine yet), and `ShumokuRenderer` reports a node or group drop through `ondrop`.
