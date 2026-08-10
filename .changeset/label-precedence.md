---
'@shumoku/core': patch
---

fix(core): pick the most name-like label, not the highest-priority one

Every source labels a node with the best it has, and "best" varies wildly: a
controller that never learned a switch's hostname reports its model, a subnet
sweep that never read the device reports the address it answered on, another
source reports a wire address. All are placeholders standing in for a name, and
choosing between them by source priority alone meant one switch displayed
`172.16.254.208` while the next displayed `IS230-10TP-AC(V1)` — purely by which
source happened to outrank the other for that device.

No placeholder is recognised by its shape: no regex, no vendor strings, no
address parsing. A label standing in for a name is one that merely repeats
another field of the same node, so each is identified by the field it echoes
and ranked by how much it tells a human reading a diagram — name, model,
address, hardware address, opaque id. Within one rank the existing priority and
recency order is untouched, and an operator-typed label is exempt: curation is
intent, not a guess.

The practical effect is that a source discovering a real hostname takes over the
label the moment it appears, however low its priority.
