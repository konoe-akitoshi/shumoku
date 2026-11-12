// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * @shumoku/core - Network topology visualization core library
 */

// The drawing layout: the lengths it is given by the renderer's kit, and the scene it makes
export {
  type Arc as DrawingArc,
  type Arrangement,
  arcsOf as drawingArcs,
  type Box as DrawingBox,
  type DrawHints,
  type Drawing,
  type DrawOptions,
  drawingBoundary,
  drawNetwork,
  drawnInPlace,
  EPS as DRAWING_EPS,
  type Hosting,
  hostingOf,
  layoutDrawing,
  layoutNetwork,
  type Metrics as DrawingMetrics,
  type OrderIntent,
  type Placed as ArrangedChild,
  type Point as DrawingPoint,
  type PortBox as DrawingPortBox,
  type PortLabelSpec as DrawingPortLabelSpec,
  type PortSide as DrawingPortSide,
  type PortSideLayout as DrawingPortSideLayout,
  type Scene as DrawingScene,
  type Side as DrawingSide,
} from './drawing/index.js'
// Fixtures
export * from './fixtures/index.js'
// Icons
export * from './icons/index.js'
// IDs
export * from './ids.js'
export { checkNetwork, NetworkInputError, type NetworkIssue } from './input/check.js'
// Network input: the current configuration as it is known. Its names (Node, Link, ...) overlap
// the drawing model's, so they are exported under inputModel.
export type * as inputModel from './input/model.js'
// Map-aware JSON (layout artifacts hold Maps)
// Models
export * from './models/index.js'
// Observation (discovery / resolve)
export * from './observation/index.js'
// Parser
// Plugin authoring kit (pure helpers: severity, alertmanager, flatten, stamp, validate)
export * from './plugin-kit/index.js'
// Plugin types
export * from './plugin-types.js'
// Structure the written network implies
export { type DeriveOptions, deriveStructure, type Structure } from './structure/index.js'
export type * as structure from './structure/types.js'
// Themes
export * from './themes/index.js'

// Version
export const version = '0.0.0'
