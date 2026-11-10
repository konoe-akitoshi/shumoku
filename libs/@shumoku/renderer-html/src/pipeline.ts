// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * HTML render pipeline: a model (or a scene already drawn) as an interactive page.
 */

import {
  type DrawingScene,
  darkTheme,
  fromNetworkGraph,
  lightTheme,
  type NetworkGraph,
  type NetworkModel,
  type ThemeType,
} from '@shumoku/core'
import { renderNetworkSvg, renderSceneSvg } from '@shumoku/renderer/static'
import * as html from './html/index.js'

export type HTMLRenderOptions = html.RenderOptions

const themeFor = (type: ThemeType) => (type === 'dark' ? darkTheme : lightTheme)

/** A model as a standalone interactive HTML page, drawn by the drawing engine. */
export function renderHtml(model: NetworkModel, options: HTMLRenderOptions = {}): string {
  const theme = options.theme ?? (model.drawing?.settings?.theme === 'dark' ? 'dark' : 'light')
  return html.render(renderNetworkSvg(model, { theme: themeFor(theme) }), { ...options, theme })
}

/** A scene already drawn (the server's baked one) as a standalone interactive HTML page. */
export function renderSceneHtml(scene: DrawingScene, options: HTMLRenderOptions = {}): string {
  const theme = options.theme ?? 'light'
  return html.render(renderSceneSvg(scene, { theme: themeFor(theme) }), { ...options, theme })
}

/** Convenience: a graph directly to HTML. */
export function renderGraphToHtml(graph: NetworkGraph, options: HTMLRenderOptions = {}): string {
  return renderHtml(fromNetworkGraph(graph).model, options)
}
