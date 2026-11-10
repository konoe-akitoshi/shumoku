// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

// Load-time migrations entry point. See ./README.md for the rules.

export {
  type BendMigrationStats,
  migrateBendNodesToLinkBends,
} from './bend-nodes-to-link-bends'
export {
  documentFromLayeredModel,
  documentFromLegacyGraph,
  isLayeredModel,
  type LayeredModel,
  type LegacyGraph,
  type LegacyTermination,
} from './legacy-network'
export { type LegacyScene, migrateLegacyWireRoutes } from './legacy-wire-routes'
export { inheritProductIconFromCatalog } from './product-icon-inheritance'
export {
  migrateScenePositionsToCenterAnchors,
  type SceneAnchorMigrationStats,
} from './scene-center-anchors'
export {
  migrateTerminationNodesToGraphTerminations,
  type TerminationMigrationStats,
} from './termination-nodes-to-graph-terminations'
