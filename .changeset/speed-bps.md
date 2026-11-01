---
"@shumoku/core": patch
---

Rename `Link.rateBps` to `speedBps` and say what it is: the link's nominal speed, for a link no module standard describes, not its current traffic. A link's speed is asked of one place, `linkSpeedBps(link)` in the models (which also takes the standards' speed over this field), and it is no longer exported from the layout.
