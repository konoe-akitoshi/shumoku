---
'shumoku': minor
---

**The wrapper follows the new core and renderers.** It re-exports all of `@shumoku/core` (models, the YAML reader, the drawing engine, themes) together with the SVG and HTML renderers. The PNG renderer is separate: `@shumoku/renderer-png`. See `@shumoku/core` for the new YAML and the APIs that replace the old ones.

- **Removed:** the hierarchical HTML functions (`renderHierarchical`, `renderHtmlHierarchical`, `renderGraphToHtmlHierarchical`) and the `svg` namespace.
- Installable from npm again: it depends on `@shumoku/renderer`, whose 0.1.5 could not be installed.
