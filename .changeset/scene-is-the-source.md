---
"@shumoku/core": patch
"@shumoku/renderer": patch
---

The drawing scene carries where each wire's caption sits (`label`, half the line's length) and, for each hull, its members' cards left to right (`boxes`) and where the wires between them cross (`seams`). The kit draws captions and hulls from them instead of recomputing; `polylineMiddle` moved from the kit to core and is exported as `drawingLabelAt`.
