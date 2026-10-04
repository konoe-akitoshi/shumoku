---
'@shumoku/renderer-html': patch
---

Escape sheet names embedded in the hierarchical HTML output's inline script, so a name containing `</script>` can't inject markup into the exported page.
