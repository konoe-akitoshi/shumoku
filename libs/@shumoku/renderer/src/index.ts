// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

export { type DrawOptions, drawNetworkScene } from './draw.js'
// The kit: draws a drawing scene (`drawNetwork` in core makes one) as SVG, the same component
// for the interactive viewer and, rendered on the server, for `@shumoku/renderer/static`.
export { default as Diagram } from './kit/Diagram.svelte'
export { drawingMetrics } from './kit/drawing-metrics.js'
export { createKit, type Kit, type Size, type TextMetrics } from './kit/measure.js'
export type { Box, Point, Scene, Side } from './kit/scene.js'
export type { Base } from './kit/tokens.js'
// Camera (pan/zoom) — opt-in for host apps
export { attachCamera, type Camera, type CameraOptions, type PanFilter } from './lib/camera.js'
// Utilities for consuming apps
export type {
  LinkOverlayContext,
  LinkOverlaySnippet,
  NodeOverlayContext,
  NodeOverlaySnippet,
  PortOverlayContext,
  PortOverlaySnippet,
  RendererOverlaySnippets,
  ScenePort,
  SubgraphOverlayContext,
  SubgraphOverlaySnippet,
} from './lib/overlays.js'
// Browser {@html} icon sanitization (defense-in-depth)
export { sanitizeInlineIcon } from './lib/sanitize-icon.js'
export {
  offsetPolyline,
  polylineOffsetPath,
  screenToSvg,
  screenToWorld,
  svgPointToContainer,
  svgRectToContainer,
  svgToScreen,
} from './lib/svg-coords.js'
