// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Layout preparation for the old HTML renderer (a drawing for the SVG output is `renderNetworkSvg`)
 *
 * Provides shared logic for icon dimension resolution and layout computation,
 * ensuring consistent rendering across all entry points (CLI, Playground, etc.)
 */

import {
  computeNetworkLayout,
  darkTheme,
  type LayoutResult,
  lightTheme,
  type NetworkGraph,
  type ResolvedLayout,
  type SurfaceToken,
} from '@shumoku/core'
import { type IconDimensions, resolveAllIconDimensions } from './icon-dims.js'
import { collectIconUrls } from './icon-urls.js'

/**
 * Prepared render data containing resolved icon dimensions and computed layout
 */
export interface PreparedRender {
  /** Original network graph */
  graph: NetworkGraph
  /** Computed layout result (legacy format, used by ELK pipeline) */
  layout: LayoutResult
  /** Resolved layout (new format, used by network pipeline) */
  resolved?: ResolvedLayout
  /** Resolved icon dimensions keyed by URL (null if no URL icons used) */
  iconDimensions: Map<string, IconDimensions> | null
}

/**
 * Options for prepareRender
 */
export interface PrepareOptions {
  /** Pre-computed layout result. If provided, layout computation is skipped. */
  layout?: LayoutResult
  /** Pre-resolved icon dimensions. If provided, icon resolution is skipped. */
  iconDimensions?: Map<string, IconDimensions>
}

/**
 * Prepare for rendering: resolve icon dimensions and compute layout.
 *
 * This is the shared entry point that ensures consistent icon handling
 * and layout computation across all render targets.
 *
 * @example
 * ```typescript
 * const prepared = await prepareRender(graph)
 * const html = renderHtml(prepared) // renderer-html
 * ```
 */
export async function prepareRender(
  graph: NetworkGraph,
  options?: PrepareOptions,
): Promise<PreparedRender> {
  // 1. Resolve icon dimensions (skip if already provided)
  let iconDimensions = options?.iconDimensions ?? null
  if (!iconDimensions) {
    const iconUrls = collectIconUrls(graph)
    if (iconUrls.length > 0) {
      iconDimensions = await resolveAllIconDimensions(iconUrls)
    }
  }

  // 2. Compute layout
  if (options?.layout) {
    // Pre-computed legacy layout
    return { graph, layout: options.layout, iconDimensions }
  }

  // Custom network layout + libavoid routing (shared with server/CLI)
  const { resolved, layout } = await computeNetworkLayout(graph)

  return { graph, layout, resolved, iconDimensions }
}

/**
 * Generate CSS variable definitions for a theme
 */
function generateThemeVars(theme: typeof lightTheme): string {
  const rc = theme.colors
  const defaultSurface = rc.surfaces['surface-1']
  const portFill = theme.variant === 'dark' ? '#64748b' : '#334155'
  const portStroke = theme.variant === 'dark' ? '#94a3b8' : '#0f172a'
  const portLabelBg = theme.variant === 'dark' ? '#0f172a' : '#0f172a'
  const surfaceTokens: SurfaceToken[] = [
    'surface-1',
    'surface-2',
    'surface-3',
    'accent-blue',
    'accent-green',
    'accent-red',
    'accent-amber',
    'accent-purple',
  ]

  const lines = [
    `--shumoku-bg: ${rc.background};`,
    `--shumoku-surface: ${defaultSurface.fill};`,
    `--shumoku-text: ${rc.text};`,
    `--shumoku-text-secondary: ${rc.textSecondary};`,
    `--shumoku-border: ${defaultSurface.stroke};`,
    `--shumoku-node-fill: ${rc.surface};`,
    `--shumoku-node-stroke: ${rc.textSecondary};`,
    `--shumoku-link-stroke: ${rc.textSecondary};`,
    `--shumoku-subgraph-label: ${defaultSurface.text};`,
    `--shumoku-port-fill: ${portFill};`,
    `--shumoku-port-stroke: ${portStroke};`,
    `--shumoku-port-label-bg: ${portLabelBg};`,
    `--shumoku-port-label-color: #ffffff;`,
    `--shumoku-endpoint-label-bg: ${rc.background};`,
    `--shumoku-endpoint-label-stroke: ${defaultSurface.stroke};`,
    // HA / stack glasses hull: deliberately theme-invariant dark slab.
    `--shumoku-ha-hull-fill: #3c3c3c;`,
  ]

  for (const t of surfaceTokens) {
    const s = rc.surfaces[t]
    lines.push(`--shumoku-${t}-fill: ${s.fill};`)
    lines.push(`--shumoku-${t}-stroke: ${s.stroke};`)
    lines.push(`--shumoku-${t}-text: ${s.text};`)
  }

  return lines.map((l) => `  ${l}`).join('\n')
}

/** Theme variables shared by embeddable and standalone HTML consumers. */
export function generateThemeCSS(): string {
  return `
/* Shumoku Theme Variables */
:root {
${generateThemeVars(lightTheme)}
}
.dark {
${generateThemeVars(darkTheme)}
}
`
}
