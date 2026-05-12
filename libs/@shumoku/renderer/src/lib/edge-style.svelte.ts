/**
 * Edge rendering style toggle (prototype).
 *
 * Toggle from devtools:
 *   window.__shumoku.setEdgeStyle('bezier')
 *   window.__shumoku.setEdgeStyle('orthogonal')
 *
 * Held in a module-level rune so every `SvgEdge` re-renders when it
 * changes. Survives across renderer instances but resets on page
 * reload — by design, this is exploratory plumbing.
 */

export type EdgeStyle = 'orthogonal' | 'bezier'

class EdgeStyleStore {
  // Default. Bezier flows out of each port for a stalk-length then
  // arcs to the destination — dense fan-outs no longer collapse into
  // a wall of bends. Orthogonal stays available via setEdgeStyle().
  current: EdgeStyle = $state('bezier')
}

export const edgeStyleStore = new EdgeStyleStore()

if (typeof window !== 'undefined') {
  const w = window as unknown as {
    __shumoku?: { setEdgeStyle: (s: EdgeStyle) => void; getEdgeStyle: () => EdgeStyle }
  }
  w.__shumoku ??= {} as never
  w.__shumoku.setEdgeStyle = (s: EdgeStyle) => {
    edgeStyleStore.current = s
  }
  w.__shumoku.getEdgeStyle = () => edgeStyleStore.current
}
