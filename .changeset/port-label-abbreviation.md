---
"@shumoku/renderer": patch
---

Show port names the way a device prints them in its brief listings (`TenGigabitEthernet1/0/1` as `Te1/0/1`, `Ethernet1/49` as `Et1/49`). Only the chip text is shortened: the stored name never changes, and the full name is the port's tooltip (an SVG `<title>`). Names that would show alike within one box keep their full spelling, and the spacing of the ports follows the shown names, so boxes with long Cisco-, Arista- or H3C-style port names come out narrower.
