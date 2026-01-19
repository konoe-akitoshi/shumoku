# @shumoku/parser-yaml

## 0.2.15

### Patch Changes

- 23a646a: fix(parser-yaml): merge export connectors to same destination subgraph

  Export connector nodes that point to the same destination subgraph are now
  merged into a single node. This reduces visual clutter when multiple devices
  connect to the same external subgraph.

  Before: Each device connection created a separate export connector node
  After: All connections to the same destination share one export connector node

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
  - @shumoku/core@0.2.3
