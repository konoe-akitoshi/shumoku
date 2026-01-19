---
"@shumoku/renderer": patch
---

feat(cli): add PNG output format support

`shumoku render` now supports PNG output:

```bash
shumoku render network.yaml -f png -o diagram.png
shumoku render network.yaml -o diagram.png  # auto-detect from extension
```

Options:
- `--scale <number>` - PNG scale factor (default: 2)

Uses resvg-js for high-quality SVG to PNG conversion.
