---
"@shumoku/core": patch
---

fix(layout): seat multi-link ports once, toward the mean of their peers

The composite router's port-seating loop assumes 1 port = 1 link, so a port
wired into several links (LLDP reporting many devices behind one switch port,
breakouts) was re-seated once per edge with last-writer-wins — its face
flip-flopped with edge order and the losing edges dropped out of the
octilinear router into long Bezier curves. Shared ports are now seated once,
toward the mean of their peers' centers, and pinned.
