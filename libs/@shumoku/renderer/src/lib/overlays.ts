import type { Node, ResolvedEdge, ResolvedPort, Subgraph } from '@shumoku/core'
import type { Snippet } from 'svelte'

export interface SubgraphOverlayContext {
  selected: boolean
  interactive: boolean
  bounds: { x: number; y: number; width: number; height: number }
}

export interface LinkOverlayContext {
  selected: boolean
  /**
   * The `<g class="link-group">` that wraps this edge. Provided so
   * overlays can attach classes / CSS variables to the group without
   * having to walk the DOM (e.g. `closest('g.link-group')`), which
   * would re-leak the renderer's class names back into overlays.
   */
  groupElement: SVGGElement | null
  pathElement: SVGPathElement | null
  pathD: string
  width: number
  fromPort: ResolvedPort | null
  toPort: ResolvedPort | null
  fromPortPosition: { x: number; y: number } | null
  toPortPosition: { x: number; y: number } | null
  fromPortLabelPosition: { x: number; y: number; textAnchor: string } | null
  toPortLabelPosition: { x: number; y: number; textAnchor: string } | null
  /**
   * Routed polyline points when this edge was routed orthogonally by the
   * layout engine. `null` for Bezier edges (port-anchored default).
   * Overlays that draw parallel lanes (e.g. weathermap in/out streams)
   * should call `polylineOffsetPath(routePoints, ±offset)` when this
   * field is non-null rather than offsetting from port positions.
   */
  routePoints: { x: number; y: number }[] | null
}

export interface NodeOverlayContext {
  selected: boolean
  interactive: boolean
  cx: number
  cy: number
  width: number
  height: number
}

export interface PortOverlayContext {
  selected: boolean
  interactive: boolean
  linked: boolean
  px: number
  py: number
  width: number
  height: number
}

export type SubgraphOverlaySnippet = Snippet<[Subgraph, SubgraphOverlayContext]>
export type LinkOverlaySnippet = Snippet<[ResolvedEdge, LinkOverlayContext]>
export type NodeOverlaySnippet = Snippet<[Node, NodeOverlayContext]>
export type PortOverlaySnippet = Snippet<[ResolvedPort, PortOverlayContext]>

export interface RendererOverlaySnippets {
  subgraphOverlay?: SubgraphOverlaySnippet
  linkOverlay?: LinkOverlaySnippet
  nodeOverlay?: NodeOverlaySnippet
  portOverlay?: PortOverlaySnippet
}
