/**
 * Svelte use: directive for d3-drag on SVG elements.
 * Each element binds its own drag — no global re-selection needed.
 */

import { drag } from 'd3-drag'
import { select } from 'd3-selection'

interface DragOptions {
  // biome-ignore lint/suspicious/noExplicitAny: d3-drag filter signature uses any for event
  filter?: (e: any) => boolean
  onDrag: (dx: number, dy: number) => void
}

/** Generic drag action for any SVG element (nodes, subgraphs, etc.) */
export function elementDrag(element: SVGElement, opts: () => DragOptions) {
  function apply() {
    const { filter, onDrag } = opts()
    const behavior = drag<SVGElement, unknown>()
    if (filter) behavior.filter(filter)
    behavior.on('drag', (e) => onDrag(e.dx, e.dy))
    select<SVGElement, unknown>(element).call(behavior)
  }

  apply()

  return {
    update() {
      apply()
    },
    destroy() {
      select(element).on('.drag', null)
    },
  }
}

/** @deprecated Use elementDrag */
export const nodeDrag = elementDrag
/** @deprecated Use elementDrag */
export const subgraphDrag = elementDrag
