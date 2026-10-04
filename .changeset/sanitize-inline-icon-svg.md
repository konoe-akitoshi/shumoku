---
'@shumoku/core': patch
'@shumoku/renderer': patch
'@shumoku/renderer-svg': patch
---

Sanitize inline SVG icons (`spec.icon`) before they are rendered, so an icon can't run script in the viewer's browser. `@shumoku/core` adds `sanitizeIconSvg` / `sanitizeIconSvgWith` (DOMPurify-based) and `@shumoku/renderer` sanitizes inline icons in its Svelte components and exports `sanitizeInlineIcon`. `@shumoku/renderer-svg` now escapes icon URLs in `<image href>`.
