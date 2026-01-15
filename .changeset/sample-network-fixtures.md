---
"@shumoku/core": minor
"@shumoku/parser-yaml": patch
"@shumoku/netbox": patch
"shumoku": patch
---

feat(core): add sampleNetwork fixture for testing and playground

- Add `sampleNetwork` fixture to `@shumoku/core/fixtures`
- Move sample data from playground to shared fixtures
- Update playground to use shared fixture
- Add comprehensive tests using sampleNetwork fixture
- Fix subgraph ID naming in netbox converter for hierarchical navigation
