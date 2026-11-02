// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Theme variables for pages that embed a drawn SVG (the standalone HTML output).
 */

import { darkTheme, lightTheme, type SurfaceToken } from '@shumoku/core'

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
