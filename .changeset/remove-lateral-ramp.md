---
'@shumoku/core': patch
---

Remove the `lateral-ramp` routing grammar. PR #625 replaced the redundancy wire notation with the glasses hull plus a normal link, but the router kept its own under-loop notation for same-tier peer links, so two notations described one idea. The surviving one also broke on close ports: its fixed 14px stubs overshoot each other when the two ports are less than 28px apart, producing a self-crossing path. Peer edges now fall through to the default port-anchored bezier.
