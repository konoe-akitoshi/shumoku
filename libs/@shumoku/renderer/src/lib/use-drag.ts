/**
 * Svelte use: directive for d3-drag on SVG elements.
 * Each element binds its own drag — no global re-selection needed.
 */

import { drag } from 'd3-drag'
import { select } from 'd3-selection'

interface NodeDragOptions {
  // biome-ignore lint/suspicious/noExplicitAny: d3-drag filter signature uses any for event
  filter?: (e: any) => boolean
  onDrag: (dx: number, dy: number) => void
}

export function nodeDrag(element: SVGGElement, opts: () => NodeDragOptions) {
  function apply() {
    const { filter, onDrag } = opts()
    const behavior = drag<SVGGElement, unknown>()
    if (filter) behavior.filter(filter)
    behavior.on('drag', (e) => onDrag(e.dx, e.dy))
    select<SVGGElement, unknown>(element).call(behavior)
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

export function subgraphDrag(
  element: SVGRectElement,
  opts: () => { onDrag: (dx: number, dy: number) => void },
) {
  function apply() {
    const { onDrag } = opts()
    const behavior = drag<SVGRectElement, unknown>().on('drag', (e) => onDrag(e.dx, e.dy))
    select<SVGRectElement, unknown>(element).call(behavior)
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
