/**
 * Resolved render colors derived from a Theme.
 * Maps 1:1 to svg.ts themeToRenderColors().
 */

import type { Theme } from '@shumoku/core'
import { lightTheme } from '@shumoku/core'

export interface RenderColors {
  background: string
  nodeFill: string
  nodeStroke: string
  nodeText: string
  nodeTextSecondary: string
  nodeHoverFill: string
  nodeHoverStroke: string
  linkStroke: string
  portFill: string
  portStroke: string
  portLabelBg: string
  portLabelColor: string
  subgraphFill: string
  subgraphStroke: string
  subgraphText: string
  textSecondary: string
  selection: string
  grid: string
}

/** Same mapping as svg.ts themeToRenderColors */
export function themeToColors(theme: Theme = lightTheme): RenderColors {
  const surface1 = theme.colors.surfaces['surface-1']
  return {
    background: theme.colors.background,
    nodeFill: theme.colors.surface,
    nodeStroke: theme.colors.textSecondary,
    nodeText: theme.colors.text,
    nodeTextSecondary: theme.colors.textSecondary,
    nodeHoverFill: theme.colors.surfaceHover,
    nodeHoverStroke: theme.colors.primary,
    linkStroke: theme.colors.textSecondary,
    portFill: theme.variant === 'dark' ? '#64748b' : '#334155',
    portStroke: theme.variant === 'dark' ? '#94a3b8' : '#0f172a',
    portLabelBg: '#0f172a',
    portLabelColor: '#ffffff',
    subgraphFill: surface1.fill,
    subgraphStroke: surface1.stroke,
    subgraphText: surface1.text,
    textSecondary: theme.colors.textSecondary,
    selection: theme.colors.primary,
    grid: theme.colors.grid ?? (theme.variant === 'dark' ? '#334155' : '#e2e8f0'),
  }
}
