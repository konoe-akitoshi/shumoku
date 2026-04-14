/**
 * Static SVG string rendering.
 *
 * Generates the same SVG output as the Svelte components,
 * using the same shared utilities (render-colors, svg-coords).
 * Works in any JS runtime (Node, Bun, Deno) without Svelte compilation.
 *
 * When Svelte SSR is available (via Vite build), use the Svelte components
 * directly with `render()` from `svelte/server` instead.
 */

import type {
  ResolvedEdge,
  ResolvedLayout,
  ResolvedNode,
  ResolvedPort,
  ResolvedSubgraph,
  Theme,
} from '@shumoku/core'
import {
  DEFAULT_ICON_SIZE,
  getDeviceIcon,
  ICON_LABEL_GAP,
  LABEL_LINE_HEIGHT,
  lightTheme,
  SMALL_LABEL_CHAR_WIDTH,
  type SurfaceToken,
} from '@shumoku/core'
import { type RenderColors, themeToColors } from './lib/render-colors'
import { computePortLabelPosition, getVlanStroke, pointsToPathD } from './lib/svg-coords'

// ============================================================================
// Escape helper
// ============================================================================

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ============================================================================
// Surface token resolution (same as SvgSubgraph.svelte)
// ============================================================================

const surfaceTokens: readonly string[] = [
  'surface-1',
  'surface-2',
  'surface-3',
  'accent-blue',
  'accent-green',
  'accent-red',
  'accent-amber',
  'accent-purple',
]

function resolveSurface(
  theme: Theme,
  colors: RenderColors,
  style?: { fill?: string; stroke?: string },
): { fill: string; stroke: string; text: string } {
  const fillValue = style?.fill
  const strokeValue = style?.stroke
  if (fillValue && surfaceTokens.includes(fillValue)) {
    const sc = theme.colors.surfaces[fillValue as SurfaceToken]
    return { fill: sc.fill, stroke: strokeValue ?? sc.stroke, text: sc.text }
  }
  return {
    fill: fillValue ?? colors.subgraphFill,
    stroke: strokeValue ?? colors.subgraphStroke,
    text: colors.subgraphText,
  }
}

// ============================================================================
// Node shape (same as SvgNode.svelte)
// ============================================================================

function renderNodeShape(
  shape: string,
  cx: number,
  cy: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  strokeWidth: number,
  dasharray: string,
): string {
  const hw = w / 2
  const hh = h / 2
  const da = dasharray ? ` stroke-dasharray="${dasharray}"` : ''
  switch (shape) {
    case 'rect':
      return `<rect x="${cx - hw}" y="${cy - hh}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${da}/>`
    case 'circle': {
      const r = Math.min(hw, hh)
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${da}/>`
    }
    case 'diamond':
      return `<polygon points="${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${da}/>`
    case 'hexagon': {
      const hx = hw * 0.866
      return `<polygon points="${cx - hw},${cy} ${cx - hx},${cy - hh} ${cx + hx},${cy - hh} ${cx + hw},${cy} ${cx + hx},${cy + hh} ${cx - hx},${cy + hh}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${da}/>`
    }
    case 'cylinder': {
      const eh = h * 0.15
      return `<g>
  <ellipse cx="${cx}" cy="${cy + hh - eh}" rx="${hw}" ry="${eh}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${da}/>
  <rect x="${cx - hw}" y="${cy - hh + eh}" width="${w}" height="${h - eh * 2}" fill="${fill}" stroke="none"/>
  <line x1="${cx - hw}" y1="${cy - hh + eh}" x2="${cx - hw}" y2="${cy + hh - eh}" stroke="${stroke}" stroke-width="${strokeWidth}"/>
  <line x1="${cx + hw}" y1="${cy - hh + eh}" x2="${cx + hw}" y2="${cy + hh - eh}" stroke="${stroke}" stroke-width="${strokeWidth}"/>
  <ellipse cx="${cx}" cy="${cy - hh + eh}" rx="${hw}" ry="${eh}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${da}/>
</g>`
    }
    case 'stadium':
      return `<rect x="${cx - hw}" y="${cy - hh}" width="${w}" height="${h}" rx="${hh}" ry="${hh}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${da}/>`
    case 'trapezoid': {
      const indent = w * 0.15
      return `<polygon points="${cx - hw + indent},${cy - hh} ${cx + hw - indent},${cy - hh} ${cx + hw},${cy + hh} ${cx - hw},${cy + hh}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${da}/>`
    }
    default: // rounded
      return `<rect x="${cx - hw}" y="${cy - hh}" width="${w}" height="${h}" rx="8" ry="8" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${da}/>`
  }
}

// ============================================================================
// Render functions (mirror Svelte components exactly)
// ============================================================================

function renderNode(node: ResolvedNode, colors: RenderColors): string {
  const { position, size, node: n } = node
  const cx = position.x
  const cy = position.y
  const style = n.style ?? {}
  const fill = style.fill ?? colors.nodeFill
  const stroke = style.stroke ?? colors.nodeStroke
  const strokeWidth = style.strokeWidth ?? 1.5
  const dasharray = style.strokeDasharray ?? ''
  const shape = n.shape ?? 'rounded'

  const bg = renderNodeShape(
    shape,
    cx,
    cy,
    size.width,
    size.height,
    fill,
    stroke,
    strokeWidth,
    dasharray,
  )

  // Icon
  const iconPath = getDeviceIcon(n.device?.type)
  const iconSize = DEFAULT_ICON_SIZE
  const iconHeight = iconPath ? iconSize : 0
  const gap = iconHeight > 0 ? ICON_LABEL_GAP : 0

  // Labels
  const labels = Array.isArray(n.label) ? n.label : [n.label ?? '']
  const labelHeight = labels.length * LABEL_LINE_HEIGHT
  const totalHeight = iconHeight + gap + labelHeight
  const contentTop = cy - totalHeight / 2
  const labelStartY = contentTop + iconHeight + gap + LABEL_LINE_HEIGHT * 0.7

  let fg = ''
  if (iconPath) {
    fg += `<g class="node-icon" transform="translate(${cx - iconSize / 2}, ${contentTop})">
  <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="currentColor">${iconPath}</svg>
</g>\n`
  }
  for (const [i, line] of labels.entries()) {
    const isBold = line.includes('<b>') || line.includes('<strong>')
    const clean = line.replace(/<\/?b>|<\/?strong>|<br\s*\/?>/gi, '')
    const isSecondary = i > 0 && !isBold
    const cls = isBold
      ? 'node-label node-label-bold'
      : isSecondary
        ? 'node-label-secondary'
        : 'node-label'
    fg += `<text x="${cx}" y="${labelStartY + i * LABEL_LINE_HEIGHT}" class="${cls}" text-anchor="middle">${esc(clean)}</text>\n`
  }

  return `<g class="node" data-id="${node.id}" filter="url(#node-shadow)">
  <g class="node-bg">${bg}</g>
  <g class="node-fg">${fg}</g>
</g>`
}

function renderPort(port: ResolvedPort, colors: RenderColors): string {
  const { absolutePosition: pos, size } = port
  const labelPos = computePortLabelPosition(port)
  const labelWidth = port.label.length * SMALL_LABEL_CHAR_WIDTH + 4
  const labelHeight = 12

  let bgX = labelPos.x - 2
  if (labelPos.textAnchor === 'middle') bgX = labelPos.x - labelWidth / 2
  else if (labelPos.textAnchor === 'end') bgX = labelPos.x - labelWidth + 2
  const bgY = labelPos.y - labelHeight + 3

  return `<g class="port" data-port="${port.id}">
  <rect class="port-box" x="${pos.x - size.width / 2}" y="${pos.y - size.height / 2}" width="${size.width}" height="${size.height}" fill="${colors.portFill}" stroke="${colors.portStroke}" stroke-width="1" rx="2"/>
  <rect class="port-label-bg" x="${bgX}" y="${bgY}" width="${labelWidth}" height="${labelHeight}" rx="2" fill="${colors.portLabelBg}"/>
  <text class="port-label" x="${labelPos.x}" y="${labelPos.y}" text-anchor="${labelPos.textAnchor}" font-size="9" fill="${colors.portLabelColor}">${esc(port.label)}</text>
</g>`
}

function renderEdge(edge: ResolvedEdge, colors: RenderColors): string {
  const pathD = pointsToPathD(edge.points)
  const link = edge.link
  const stroke = link?.style?.stroke ?? getVlanStroke(link?.vlan) ?? colors.linkStroke
  const dasharray = link?.type === 'dashed' ? '5 3' : (link?.style?.strokeDasharray ?? '')

  let line: string
  if (link?.type === 'double') {
    const gap = Math.max(3, Math.round(edge.width * 0.9))
    line = `<path d="${pathD}" fill="none" stroke="${stroke}" stroke-width="${edge.width + gap * 2}" stroke-linecap="round" pointer-events="none"/>
  <path d="${pathD}" fill="none" stroke="white" stroke-width="${Math.max(1, edge.width)}" stroke-linecap="round" pointer-events="none"/>
  <path d="${pathD}" fill="none" stroke="${stroke}" stroke-width="${Math.max(1, edge.width - Math.round(gap * 0.8))}" stroke-linecap="round" pointer-events="none"/>`
  } else {
    line = `<path class="link" d="${pathD}" fill="none" stroke="${stroke}" stroke-width="${edge.width}" stroke-linecap="round"${dasharray ? ` stroke-dasharray="${dasharray}"` : ''} pointer-events="none"/>`
  }

  // Labels
  let labels = ''
  if (edge.points.length >= 2) {
    const midIdx = Math.floor(edge.points.length / 2)
    const a = edge.points[midIdx - 1]
    const b = edge.points[midIdx]
    if (a && b) {
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      let yOff = -8
      if (link?.label) {
        const labelText = Array.isArray(link.label) ? link.label.join(' / ') : link.label
        labels += `\n  <text x="${mx}" y="${my + yOff}" class="link-label" text-anchor="middle">${esc(labelText)}</text>`
        yOff += 12
      }
      if (link?.vlan && link.vlan.length > 0) {
        const vlanText =
          link.vlan.length === 1 ? `VLAN ${link.vlan[0]}` : `VLAN ${link.vlan.join(', ')}`
        labels += `\n  <text x="${mx}" y="${my + yOff}" class="link-label" text-anchor="middle">${esc(vlanText)}</text>`
      }
    }
  }

  return `<g class="link-group" data-link-id="${edge.id}">
  ${line}${labels}
</g>`
}

function renderSubgraph(sg: ResolvedSubgraph, theme: Theme, colors: RenderColors): string {
  const surface = resolveSurface(theme, colors, sg.subgraph.style)
  const strokeWidth = sg.subgraph.style?.strokeWidth ?? 3
  const dasharray = sg.subgraph.style?.strokeDasharray ?? ''

  return `<g class="subgraph" data-id="${sg.id}">
  <rect x="${sg.bounds.x}" y="${sg.bounds.y}" width="${sg.bounds.width}" height="${sg.bounds.height}" rx="12" ry="12" fill="${surface.fill}" stroke="${surface.stroke}" stroke-width="${strokeWidth}"${dasharray ? ` stroke-dasharray="${dasharray}"` : ''}/>
  <text x="${sg.bounds.x + 10}" y="${sg.bounds.y + 20}" class="subgraph-label" text-anchor="start" fill="${surface.text}">${esc(sg.subgraph.label)}</text>
</g>`
}

// ============================================================================
// Public API
// ============================================================================

export interface StaticRenderOptions {
  theme?: Theme
}

/**
 * Render a ResolvedLayout to SVG string.
 * Produces identical output to the Svelte SVG components.
 */
export function renderSvgString(layout: ResolvedLayout, options?: StaticRenderOptions): string {
  const theme = options?.theme ?? lightTheme
  const colors = themeToColors(theme)

  const { bounds } = layout
  const vb = `${bounds.x - 50} ${bounds.y - 50} ${bounds.width + 100} ${bounds.height + 100}`

  const monoFont = 'ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace'
  const sansFont = 'system-ui, -apple-system, sans-serif'

  const parts: string[] = []

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" style="background: transparent;">`,
  )

  // Defs
  parts.push(`<defs>
  <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
    <polygon points="0 0, 10 3.5, 0 7" fill="${colors.linkStroke}"/>
  </marker>
  <filter id="node-shadow" x="-10%" y="-10%" width="120%" height="120%">
    <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#101828" flood-opacity="0.06"/>
  </filter>
</defs>`)

  // Styles
  parts.push(`<style>
  .node-label { font-family: ${sansFont}; font-size: 14px; font-weight: 600; fill: ${colors.nodeText}; }
  .node-label-bold { font-weight: 700; }
  .node-label-secondary { font-family: ${monoFont}; font-size: 10px; font-weight: 400; fill: ${colors.nodeTextSecondary}; }
  .node-icon { color: ${colors.nodeTextSecondary}; }
  .subgraph-label { font-family: ${sansFont}; font-size: 11px; font-weight: 700; fill: ${colors.subgraphText}; text-transform: uppercase; letter-spacing: 0.05em; }
  .link-label { font-family: ${monoFont}; font-size: 10px; fill: ${colors.textSecondary}; }
</style>`)

  // Subgraphs (background)
  for (const sg of layout.subgraphs.values()) {
    parts.push(renderSubgraph(sg, theme, colors))
  }

  // Edges
  for (const edge of layout.edges.values()) {
    parts.push(renderEdge(edge, colors))
  }

  // Nodes + ports
  for (const node of layout.nodes.values()) {
    parts.push(renderNode(node, colors))
  }
  for (const port of layout.ports.values()) {
    parts.push(renderPort(port, colors))
  }

  parts.push('</svg>')
  return parts.join('\n')
}

/**
 * Full pipeline: compute layout + render to SVG string.
 */
export async function renderGraphToSvg(
  graph: import('@shumoku/core').NetworkGraph,
  options?: StaticRenderOptions,
): Promise<string> {
  const { computeNetworkLayout } = await import('@shumoku/core')
  const { resolved } = await computeNetworkLayout(graph)
  return renderSvgString(resolved, options)
}
