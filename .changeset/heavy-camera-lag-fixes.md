---
'@shumoku/renderer': patch
---

Fix pan/zoom lag on large diagrams: cache the root CTM per wheel gesture (was forcing a synchronous reflow on every wheel event), coalesce viewport transform writes to one per animation frame, drop per-node feDropShadow filters and port/link labels while a camera gesture is active (`.camera-gesture` class on the svg, now also applied during drag pans), and stop re-applying the last wheel event when wheel-gestures delivers its gesture-end notification (zoomed one extra step ~400ms after scrolling stopped).
