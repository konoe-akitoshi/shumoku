# @shumoku/renderer

## 0.2.24

### Patch Changes

- ad2afe4: Add PNG export as separate entry point (`@shumoku/renderer/png`) to avoid bundling Node-only resvg in browser builds

## 0.2.23

### Patch Changes

- 0e715f4: Modernize design system with improved colors, typography, and zone styling. Fix endpoint label background sizing.
- Updated dependencies [0e715f4]
  - @shumoku/core@0.2.23

## 0.2.17

### Patch Changes

- 1bd9978: feat(cli): add PNG output format support

  `shumoku render` now supports PNG output:

  ```bash
  shumoku render network.yaml -f png -o diagram.png
  shumoku render network.yaml -o diagram.png  # auto-detect from extension
  ```

  Options:

  - `--scale <number>` - PNG scale factor (default: 2)

  Uses resvg-js for high-quality SVG to PNG conversion.

## 0.2.16

### Patch Changes

- 6f5e4fc: fix(cli): register vendor icons in shumoku render command

  The CLI now imports `@shumoku/icons` to auto-register vendor icons,
  fixing the issue where icons were not displayed in generated diagrams.

## 0.2.15

### Patch Changes

- 18d7daf: style(renderer): remove drop shadows from nodes for modern flat design

  Drop shadows on node shapes have been removed to achieve a cleaner,
  more contemporary visual appearance. This affects all node shapes
  (rect, rounded, circle, diamond, hexagon, cylinder, stadium, trapezoid).

- Updated dependencies [23a646a]
  - @shumoku/parser-yaml@0.2.15

## 0.2.14

### Patch Changes

- 2b6ff1a: feat: add JSON output support for netbox CLI and shumoku render CLI

  - netbox CLI: `--format json` or `-o file.json` outputs NetworkGraph JSON
  - new `shumoku render` CLI in @shumoku/renderer to render JSON to SVG/HTML
  - enables workflow: NetBox → JSON → merge/modify → render

## 0.2.3

### Patch Changes

- Fix: republish with correct code from master
- Updated dependencies
  - @shumoku/core@0.2.3
