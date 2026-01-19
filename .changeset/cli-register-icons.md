---
"@shumoku/renderer": patch
---

fix(cli): register vendor icons in shumoku render command

The CLI now imports `@shumoku/icons` to auto-register vendor icons,
fixing the issue where icons were not displayed in generated diagrams.
