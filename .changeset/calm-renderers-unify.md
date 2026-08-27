---
'@shumoku/cli': patch
'@shumoku/renderer': patch
'@shumoku/renderer-html': patch
'@shumoku/renderer-png': patch
'@shumoku/renderer-svg': patch
'shumoku': patch
---

Use the canonical ResolvedLayout-based static renderer for CLI SVG/PNG/HTML, server SSR output, Editor export, Playground, and the public SVG/PNG/HTML graph APIs. Preserve tooltip and hierarchical-navigation DOM metadata, add Svelte/static parity coverage for HA hulls, ports, edges, and themes, and isolate the old LayoutResult renderer behind deprecated compatibility exports and prepared-render fallbacks.
