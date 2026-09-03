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
  Node,
  ResolvedEdge,
  ResolvedLayout,
  ResolvedPort,
  Subgraph,
  Theme,
} from '@shumoku/core'
import {
  buildHaHullPath,
  createEngine,
  DEFAULT_ICON_SIZE,
  darkTheme,
  groupCouplingPairs,
  ICON_LABEL_GAP,
  LABEL_LINE_HEIGHT,
  lightTheme,
  portLabelLength,
  resolveNodeSize as resolveCoreNodeSize,
  resolveIcon,
  type SurfaceToken,
  specDeviceType,
} from '@shumoku/core'

/** Shared sizing engine for static SSR / CLI rendering. */
const engine = createEngine()
const resolveNodeSize = (n: {
  label?: string | string[]
  size?: { width: number; height: number }
}) => n.size ?? engine.nodeBodySize(n as Parameters<typeof engine.nodeBodySize>[0])

import { type RenderColors, themeToColors } from './lib/render-colors'
import {
  bezierEdgePath,
  computePortLabelPosition,
  getVlanStroke,
  polylinePath,
} from './lib/svg-coords'

// ============================================================================
// Escape helper
// ============================================================================

function esc(s: string | null | undefined): string {
  return (s ?? '')
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

function renderNode(node: Node, colors: RenderColors): string {
  const cx = node.position?.x ?? 0
  const cy = node.position?.y ?? 0
  const size = resolveNodeSize(node)
  const style = node.style ?? {}
  const fill = style.fill ?? colors.nodeFill
  const stroke = style.stroke ?? colors.nodeStroke
  const strokeWidth = style.strokeWidth ?? 1.5
  const dasharray = style.strokeDasharray ?? ''
  const shape = node.shape ?? 'rounded'

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
  const icon = resolveIcon(node.spec)
  const iconSize = DEFAULT_ICON_SIZE
  const iconHeight = icon ? iconSize : 0
  const gap = iconHeight > 0 ? ICON_LABEL_GAP : 0

  // Labels
  const labels = Array.isArray(node.label) ? node.label : [node.label ?? '']
  const labelHeight = labels.length * LABEL_LINE_HEIGHT
  const totalHeight = iconHeight + gap + labelHeight
  const contentTop = cy - totalHeight / 2
  const labelStartY = contentTop + iconHeight + gap + LABEL_LINE_HEIGHT * 0.7

  let fg = ''
  if (icon) {
    const label = esc(specDeviceType(node.spec) ?? 'icon')
    const iconMarkup =
      icon.kind === 'inline'
        ? `<svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="${label}">${icon.svg}</svg>`
        : `<image href="${esc(icon.url)}" width="${iconSize}" height="${iconSize}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${label}"/>`
    fg += `<g class="node-icon" transform="translate(${cx - iconSize / 2}, ${contentTop})">
  ${iconMarkup}
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

  const dataAttributes = [`data-id="${esc(node.id)}"`]
  const deviceType = specDeviceType(node.spec)
  if (deviceType) dataAttributes.push(`data-device-type="${esc(deviceType)}"`)
  if (node.spec?.vendor) dataAttributes.push(`data-device-vendor="${esc(node.spec.vendor)}"`)
  if (node.spec?.kind === 'hardware' && node.spec.model) {
    dataAttributes.push(`data-device-model="${esc(node.spec.model)}"`)
  }
  if (node.spec?.kind === 'service') {
    dataAttributes.push(`data-device-service="${esc(node.spec.service)}"`)
    if (node.spec.resource) {
      dataAttributes.push(`data-device-resource="${esc(node.spec.resource)}"`)
    }
  }
  if (node.parent) dataAttributes.push(`data-parent="${esc(node.parent)}"`)

  return `<g class="node" ${dataAttributes.join(' ')} filter="url(#node-shadow)">
  <g class="node-bg">${bg}</g>
  <g class="node-fg">${fg}</g>
</g>`
}

function renderPort(port: ResolvedPort, colors: RenderColors): string {
  const { absolutePosition: pos, size } = port
  const couplingBar = port.coupling === true
  const onSide = port.side === 'left' || port.side === 'right'
  const barLength = Math.max(32, Math.min(56, portLabelLength(port.label ?? '') + 16))
  const width = couplingBar ? (onSide ? 14 : barLength) : size.width
  const height = couplingBar ? (onSide ? barLength : 14) : size.height
  const labelPos = computePortLabelPosition(port)
  const labelWidth = portLabelLength(port.label ?? '')
  const labelHeight = 12
  const hasLabel = (port.label ?? '').trim().length > 0
  const verticalLabel =
    port.labelOrientation === 'vertical' && (port.side === 'top' || port.side === 'bottom')

  let bgX = labelPos.x - 2
  if (labelPos.textAnchor === 'middle') bgX = labelPos.x - labelWidth / 2
  else if (labelPos.textAnchor === 'end') bgX = labelPos.x - labelWidth + 2
  const bgY = labelPos.y - labelHeight + 3

  let labelMarkup = ''
  if (hasLabel && couplingBar) {
    const transform = onSide
      ? ` transform="rotate(${port.side === 'right' ? -90 : 90} ${pos.x} ${pos.y})"`
      : ''
    labelMarkup = `
  <g${transform} pointer-events="none">
    <text class="port-label-text" x="${pos.x}" y="${pos.y + 3}" text-anchor="middle" font-size="8.5" fill="${colors.portLabelColor}">${esc(port.label)}</text>
  </g>`
  } else if (hasLabel && verticalLabel) {
    labelMarkup = `
  <g transform="rotate(${port.side === 'top' ? -90 : 90} ${pos.x} ${pos.y})" pointer-events="none">
    <rect class="port-label-bg" x="${pos.x + 10}" y="${pos.y - labelHeight + 3}" width="${labelWidth}" height="${labelHeight}" rx="2" fill="${colors.portLabelBg}"/>
    <text class="port-label-text" x="${pos.x + 12}" y="${pos.y}" text-anchor="start" font-size="9" fill="${colors.portLabelColor}">${esc(port.label)}</text>
  </g>`
  } else if (hasLabel) {
    labelMarkup = `
  <rect class="port-label-bg" x="${bgX}" y="${bgY}" width="${labelWidth}" height="${labelHeight}" rx="2" fill="${colors.portLabelBg}" pointer-events="none"/>
  <text class="port-label-text" x="${labelPos.x}" y="${labelPos.y}" text-anchor="${labelPos.textAnchor}" font-size="9" fill="${colors.portLabelColor}">${esc(port.label)}</text>`
  }

  return `<g class="port" data-port="${esc(port.id)}" data-port-device="${esc(port.nodeId)}">
  <rect class="port-hit" x="${pos.x - 12}" y="${pos.y - 12}" width="24" height="24" fill="transparent"/>
  <rect class="port-box" x="${pos.x - width / 2}" y="${pos.y - height / 2}" width="${width}" height="${height}" fill="${colors.portFill}" stroke="${colors.portStroke}" stroke-width="1" rx="${couplingBar ? 4 : 2}" pointer-events="none"/>${labelMarkup}
</g>`
}

function renderEdge(edge: ResolvedEdge, colors: RenderColors): string {
  // Orthogonal (bus / polyline) routes are drawn as right-angle
  // polylines with light corner rounding; everything else falls back
  // to the standard port-anchored Bezier.
  const pathD = edge.route
    ? polylinePath(edge.route.points)
    : edge.fromPort && edge.toPort
      ? bezierEdgePath(
          { ...edge.fromPort, lateralOffset: edge.fromLateralOffset },
          { ...edge.toPort, lateralOffset: edge.toLateralOffset },
        )
      : `M ${edge.points[0]?.x ?? 0} ${edge.points[0]?.y ?? 0} L ${edge.points[1]?.x ?? 0} ${edge.points[1]?.y ?? 0}`
  const link = edge.link
  const stroke = link?.style?.stroke ?? getVlanStroke(link?.vlan) ?? colors.linkStroke
  const dasharray = link?.type === 'dashed' ? '5 3' : (link?.style?.strokeDasharray ?? '')
  const coupling = link?.redundancy !== undefined || edge.coupling === true
  const strokeOpacity = edge.emphasis === 'secondary' ? 0.45 : 1

  let line: string
  if (link?.type === 'double') {
    const gap = Math.max(3, Math.round(edge.width * 0.9))
    line = `<path d="${pathD}" fill="none" stroke="${stroke}" stroke-width="${edge.width + gap * 2}" stroke-linecap="round" pointer-events="none"/>
  <path d="${pathD}" fill="none" stroke="white" stroke-width="${Math.max(1, edge.width)}" stroke-linecap="round" pointer-events="none"/>
  <path d="${pathD}" fill="none" stroke="${stroke}" stroke-width="${Math.max(1, edge.width - Math.round(gap * 0.8))}" stroke-linecap="round" pointer-events="none"/>`
  } else {
    line = `<path class="${coupling ? 'link link-ha' : 'link'}" d="${pathD}" fill="none" stroke="${stroke}" stroke-width="${edge.width}" stroke-opacity="${strokeOpacity}" stroke-linecap="round"${dasharray ? ` stroke-dasharray="${dasharray}"` : ''} pointer-events="none"/>`
  }

  // Labels
  let labels = ''
  if (edge.labelAnchor || edge.points.length >= 2) {
    const midIdx = Math.floor(edge.points.length / 2)
    const a = edge.points[midIdx - 1]
    const b = edge.points[midIdx]
    const midpoint =
      edge.labelAnchor ?? (a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : null)
    if (midpoint) {
      const { x: mx, y: my } = midpoint
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

  const from = edge.fromEndpoint.port
    ? `${edge.fromEndpoint.node}:${edge.fromEndpoint.port}`
    : edge.fromEndpoint.node
  const to = edge.toEndpoint.port
    ? `${edge.toEndpoint.node}:${edge.toEndpoint.port}`
    : edge.toEndpoint.node
  const dataAttributes = [
    `data-link-id="${esc(edge.id)}"`,
    `data-link-from="${esc(from)}"`,
    `data-link-to="${esc(to)}"`,
  ]
  const fromStandard = link?.from.plug?.module?.standard
  const toStandard = link?.to.plug?.module?.standard
  if (fromStandard) dataAttributes.push(`data-link-from-standard="${esc(fromStandard)}"`)
  if (toStandard) dataAttributes.push(`data-link-to-standard="${esc(toStandard)}"`)
  if (link?.vlan && link.vlan.length > 0) {
    dataAttributes.push(`data-link-vlan="${esc(link.vlan.join(','))}"`)
  }
  if (link?.redundancy) {
    dataAttributes.push(`data-link-redundancy="${esc(link.redundancy)}"`)
  }
  const destinationDevice = link?.metadata?.['_destDevice']
  const destinationPort = link?.metadata?.['_destPort']
  if (destinationDevice) {
    dataAttributes.push(`data-link-dest-device="${esc(String(destinationDevice))}"`)
    if (destinationPort) {
      dataAttributes.push(`data-link-dest-port="${esc(String(destinationPort))}"`)
    }
  }

  const hitArea = `<path class="link-hit link-hit-area" d="${pathD}" fill="none" stroke="transparent" stroke-width="${Math.max(edge.width + 12, 16)}" stroke-linecap="round"/>`

  return `<g class="link-group" ${dataAttributes.join(' ')}>
  ${line}
  ${hitArea}${labels}
</g>`
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

function renderHaHulls(layout: ResolvedLayout, colors: RenderColors): string[] {
  const pairs: Array<{ a: string; b: string; kind?: string }> = []
  const seamYByPair = new Map<string, number>()
  for (const edge of layout.edges.values()) {
    if (!edge.coupling) continue
    pairs.push({ a: edge.fromNodeId, b: edge.toNodeId, kind: edge.link.redundancy })
    seamYByPair.set(
      pairKey(edge.fromNodeId, edge.toNodeId),
      (edge.fromPort.absolutePosition.y + edge.toPort.absolutePosition.y) / 2,
    )
  }

  const rendered: string[] = []
  for (const group of groupCouplingPairs(pairs)) {
    const placed: Array<{ id: string; x: number; y: number; width: number; height: number }> = []
    for (const id of group.members) {
      const node = layout.nodes.get(id)
      if (!node?.position) continue
      const size = resolveCoreNodeSize(node)
      placed.push({
        id,
        x: node.position.x - size.width / 2,
        y: node.position.y - size.height / 2,
        width: size.width,
        height: size.height,
      })
    }
    if (placed.length === 0) continue
    placed.sort((a, b) => a.x + a.width / 2 - (b.x + b.width / 2))

    const seams: Array<{ y: number }> = []
    for (const [index, left] of placed.entries()) {
      const right = placed[index + 1]
      if (!right) continue
      const y = seamYByPair.get(pairKey(left.id, right.id))
      seams.push({ y: y ?? (left.y + left.height / 2 + right.y + right.height / 2) / 2 })
    }

    const hull = buildHaHullPath({ members: placed, seams })
    rendered.push(`<g class="ha-hull" pointer-events="none">
  <path d="${hull.d}" fill="${colors.haHullFill}"/>
  <text class="ha-hull-label" x="${hull.bounds.x + 2}" y="${hull.bounds.y - 6}" font-size="9" letter-spacing="0.08em" fill="${colors.textSecondary}">${esc((group.kind ?? 'ha').toUpperCase())}</text>
</g>`)
  }
  return rendered
}

function renderSubgraph(sg: Subgraph, theme: Theme, colors: RenderColors): string {
  const surface = resolveSurface(theme, colors, sg.style)
  const strokeWidth = sg.style?.strokeWidth ?? 3
  const dasharray = sg.style?.strokeDasharray ?? ''
  const bx = sg.bounds?.x ?? 0
  const by = sg.bounds?.y ?? 0
  const bw = sg.bounds?.width ?? 0
  const bh = sg.bounds?.height ?? 0

  const hasSheet = Boolean(sg.file || (sg.pins && sg.pins.length > 0))
  const sheetAttributes = hasSheet
    ? ` data-has-sheet="true" data-sheet-id="${esc(sg.id)}" data-bounds="${esc(
        JSON.stringify({ x: bx, y: by, width: bw, height: bh }),
      )}"`
    : ''

  return `<g class="subgraph" data-id="${esc(sg.id)}"${sheetAttributes}>
  <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="12" ry="12" fill="${surface.fill}" stroke="${surface.stroke}" stroke-width="${strokeWidth}"${dasharray ? ` stroke-dasharray="${dasharray}"` : ''}/>
  <text x="${bx + 10}" y="${by + 20}" class="subgraph-label" text-anchor="start" fill="${surface.text}">${esc(sg.label)}</text>
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
 * Produces the same visual geometry and styling as the Svelte SVG components,
 * including transparent hit areas required by HTML wrappers, but without event bindings.
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
  .port-label-text { font-family: ${monoFont}; }
  .ha-hull-label { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-weight: 600; }
</style>`)

  // Subgraphs (background)
  for (const sg of layout.subgraphs.values()) {
    parts.push(renderSubgraph(sg, theme, colors))
  }

  // HA / stack hulls (behind edges + nodes, above subgraph fills)
  parts.push(...renderHaHulls(layout, colors))

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
  const theme = options?.theme ?? (graph.settings?.theme === 'dark' ? darkTheme : lightTheme)
  return renderSvgString(resolved, { ...options, theme })
}
