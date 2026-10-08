// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * @shumoku/core - Network topology visualization core library
 */

// Constants
export * from './constants.js'
// Fixtures
export * from './fixtures/index.js'
// Hierarchical
export * from './hierarchical.js'
// Icons
export * from './icons/index.js'
// IDs
export * from './ids.js'
// Network input: the current configuration as it is known. Its schema names (Node, Link, ...)
// overlap the drawing model's, so they are exported under inputSchema.
export {
  addressList,
  bitsPerSecond,
  flattenGroups,
  type InputIssue,
  type InputResult,
  parseNetworkInput,
  readNetworkInput,
  toLegacyInput,
} from './input/index.js'
export * as inputSchema from './input/schema.js'
// Layout
export * from './layout/index.js'
// Map-aware JSON (layout artifacts hold Maps)
export * from './map-json.js'
// Models
export * from './models/index.js'
// Observation (discovery / resolve)
export * from './observation/index.js'
// Parser
export * from './parser/index.js'
// Plugin authoring kit (pure helpers: severity, alertmanager, flatten, stamp, validate)
export * from './plugin-kit/index.js'
// Plugin types
export * from './plugin-types.js'
// Themes
export * from './themes/index.js'

// Version
export const version = '0.0.0'
