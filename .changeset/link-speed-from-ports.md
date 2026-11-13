---
"@shumoku/core": patch
---

A link that names no speed and no module standard takes the slower of its ends' port speeds (the only one when one end names it), so lines are drawn by the speeds real devices report.

A step too small for a jog between two ports that no neighbour can widen is left as it is, where it stopped drawing ("the constraints contain a cycle") once lines of different widths moved the ports.
