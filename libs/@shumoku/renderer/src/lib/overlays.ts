import type { Link, Node, Subgraph } from '@shumoku/core'
import type { Snippet } from 'svelte'
import type { Box, Point, Scene } from '../kit/scene'

/** A port as the scene draws it. */
export type ScenePort = NonNullable<Scene['ports']>[number]

export interface SubgraphOverlayContext {
  selected: boolean
  interactive: boolean
  bounds: Box
}

export interface LinkOverlayContext {
  selected: boolean
  /**
   * The `<g class="link-group">` that wraps this wire. Provided so overlays can attach classes /
   * CSS variables to the group without walking the DOM (e.g. `closest('g.link-group')`), which
   * would leak the renderer's class names back into overlays. Null until the wire is mounted, and
   * reactive: read it inside an effect.
   */
  groupElement: SVGGElement | null
  /** The wire's `<path class="link">`; null until mounted, reactive like `groupElement`. */
  pathElement: SVGPathElement | null
  /** The path the wire is drawn with. */
  pathD: string
  /** The width the wire is drawn at: the room a lane overlay may fill. */
  width: number
  /**
   * The wire's polyline and the radius each vertex is rounded with. Overlays that draw parallel
   * lanes (e.g. weathermap in/out streams) offset these with `polylineOffsetPath`.
   */
  routePoints: Point[]
  radii: number[]
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
  px: number
  py: number
}

export type SubgraphOverlaySnippet = Snippet<[Subgraph, SubgraphOverlayContext]>
export type LinkOverlaySnippet = Snippet<[Link, LinkOverlayContext]>
export type NodeOverlaySnippet = Snippet<[Node, NodeOverlayContext]>
export type PortOverlaySnippet = Snippet<[ScenePort, PortOverlayContext]>

export interface RendererOverlaySnippets {
  subgraphOverlay?: SubgraphOverlaySnippet
  linkOverlay?: LinkOverlaySnippet
  nodeOverlay?: NodeOverlaySnippet
  portOverlay?: PortOverlaySnippet
}
