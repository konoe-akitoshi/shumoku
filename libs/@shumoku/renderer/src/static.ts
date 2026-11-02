// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Static drawing for Node and Bun, which have no Svelte plugin: this file is built on its own
 * (`vite.static.config.ts`) into plain JS with the kit compiled for the server, and that is what
 * `@shumoku/renderer/static` exports. A model goes in, an SVG string comes out; the string is
 * `Diagram.svelte` rendered on the server, so it is the drawing the interactive viewer shows.
 */

import {
  type DrawingScene,
  darkTheme,
  drawNetwork,
  lightTheme,
  type NetworkModel,
  type Theme,
} from '@shumoku/core'
import { drawingMetrics } from './kit/drawing-metrics'
import { createKit, type TextMetrics } from './kit/measure'
import { renderScene } from './kit/static'
import type { Base } from './kit/tokens'

export interface NetworkSvgOptions {
  /** Defaults to the model's own (drawing settings), then light. */
  theme?: Theme
  /** Body font size and base line width; every size follows from them. */
  base?: Partial<Base>
  /** Measures text; a deterministic estimate when absent, so every machine draws the same. */
  text?: TextMetrics
}

/** Draws a model as a scene, with the lengths of the kit these options describe. */
export function drawNetworkScene(
  model: NetworkModel,
  options: Pick<NetworkSvgOptions, 'base' | 'text'> = {},
): DrawingScene {
  const kit = createKit(options.base, options.text)
  return drawNetwork(model, { metrics: (m) => drawingMetrics(kit, m) })
}

/** A scene as a standalone SVG string. */
export function renderSceneSvg(scene: DrawingScene, options: NetworkSvgOptions = {}): string {
  return renderScene(scene, options)
}

/** A model as a standalone SVG string: `drawNetwork`, then the kit. */
export function renderNetworkSvg(model: NetworkModel, options: NetworkSvgOptions = {}): string {
  const theme =
    options.theme ?? (model.drawing?.settings?.theme === 'dark' ? darkTheme : lightTheme)
  return renderSceneSvg(drawNetworkScene(model, options), { ...options, theme })
}
