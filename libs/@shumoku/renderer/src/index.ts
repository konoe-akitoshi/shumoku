// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

// Camera (pan/zoom) — opt-in for host apps
export { attachCamera, type Camera, type CameraOptions, type PanFilter } from './lib/camera'
// Utilities for consuming apps
export type {
  LinkOverlayContext,
  LinkOverlaySnippet,
  NodeOverlayContext,
  NodeOverlaySnippet,
  PortOverlayContext,
  PortOverlaySnippet,
  RendererOverlaySnippets,
  SubgraphOverlayContext,
  SubgraphOverlaySnippet,
} from './lib/overlays'
export { type RenderColors, themeToColors } from './lib/render-colors'
// Serialization (save/load layout state)
export {
  deserializeLayout,
  jsonToLayout,
  layoutToJson,
  type SerializedLayout,
  serializeLayout,
} from './lib/serialization'
export {
  computePortLabelPosition,
  getNodeLabel,
  getVlanStroke,
  pointsToPathD,
  screenToSvg,
  svgPointToContainer,
  svgRectToContainer,
  svgToScreen,
} from './lib/svg-coords'
// Static SVG rendering (CLI, PNG, SSR)
export { renderGraphToSvg, renderSvgString } from './static'
