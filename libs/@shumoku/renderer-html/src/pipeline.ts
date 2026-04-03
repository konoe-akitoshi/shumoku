// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * HTML render pipeline functions
 * Bridges renderer-svg's PreparedRender with HTML output
 */

import {
  buildHierarchicalSheets,
  HierarchicalLayout,
  type NetworkGraph,
  type SheetData,
} from '@shumoku/core'
import type { PreparedRender } from '@shumoku/renderer-svg'
import { prepareRender } from '@shumoku/renderer-svg'
import * as html from './html/index.js'

/**
 * Options for HTML rendering
 */
export interface HTMLRenderOptions {
  title?: string
  branding?: boolean
  toolbar?: boolean
  /** Pre-computed hierarchical sheets (skips buildHierarchicalSheets) */
  sheets?: Map<string, SheetData>
}

/**
 * Render prepared data to interactive HTML
 */
export function renderHtml(prepared: PreparedRender, options?: HTMLRenderOptions): string {
  return html.render(prepared.graph, prepared.layout, options)
}

/**
 * Render prepared data to hierarchical HTML with sheet navigation
 */
export async function renderHtmlHierarchical(
  prepared: PreparedRender,
  options?: HTMLRenderOptions,
): Promise<string> {
  const sheets =
    options?.sheets ??
    (await buildHierarchicalSheets(prepared.graph, prepared.layout, new HierarchicalLayout()))
  return html.renderHierarchical(sheets, options)
}

/**
 * Convenience: render graph directly to HTML
 */
export async function renderGraphToHtml(
  graph: NetworkGraph,
  options?: HTMLRenderOptions,
): Promise<string> {
  const prepared = await prepareRender(graph)
  return renderHtml(prepared, options)
}

/**
 * Convenience: render graph directly to hierarchical HTML
 */
export async function renderGraphToHtmlHierarchical(
  graph: NetworkGraph,
  options?: HTMLRenderOptions,
): Promise<string> {
  const prepared = await prepareRender(graph)
  return renderHtmlHierarchical(prepared, options)
}
