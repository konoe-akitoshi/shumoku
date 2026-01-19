# @shumoku/netbox

## 0.2.18

### Patch Changes

- 1fc64a5: Add --debug option to show API requests/responses for troubleshooting

## 0.2.14

### Patch Changes

- 2b6ff1a: feat: add JSON output support for netbox CLI and shumoku render CLI

  - netbox CLI: `--format json` or `-o file.json` outputs NetworkGraph JSON
  - new `shumoku render` CLI in @shumoku/renderer to render JSON to SVG/HTML
  - enables workflow: NetBox → JSON → merge/modify → render

- Updated dependencies [2b6ff1a]
  - @shumoku/renderer@0.2.14

## 0.2.13

### Patch Changes

- 59fb135: feat(core): add sampleNetwork fixture for testing and playground

  - Add `sampleNetwork` fixture to `@shumoku/core/fixtures`
  - Move sample data from playground to shared fixtures
  - Update playground to use shared fixture
  - Add comprehensive tests using sampleNetwork fixture
  - Fix subgraph ID naming in netbox converter for hierarchical navigation

- Updated dependencies [59fb135]
  - @shumoku/core@0.2.13

## 0.2.3

### Patch Changes

- Fix: republish with correct code from master
- Updated dependencies
  - @shumoku/renderer@0.2.3
  - @shumoku/core@0.2.3
  - @shumoku/icons@0.2.3

## 0.2.2

### Patch Changes

- 3d7ff7d: Fix CLI binary not included in npm package

## 0.2.1

### Patch Changes

- bf748a4: Add --legend CLI option to show legend in SVG output
