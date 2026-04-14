/**
 * Svelte use: directive for d3-drag on SVG elements.
 * Each element binds its own drag — no global re-selection needed.
 * Drag is disabled when interactive=false (view mode).
 */

import { drag } from 'd3-drag'
import { select } from 'd3-selection'

interface DragOptions {
  /** Must be true for drag to work (edit mode). Defaults to true for backward compat. */
  interactive?: boolean
  // biome-ignore lint/suspicious/noExplicitAny: d3-drag filter signature uses any for event
  filter?: (e: any) => boolean
  onDrag: (dx: number, dy: number) => void
}

/** Generic drag action for any SVG element (nodes, subgraphs, etc.) */
export function elementDrag(element: SVGElement, opts: () => DragOptions) {
  function apply() {
    const { interactive = true, filter, onDrag } = opts()
    const behavior = drag<SVGElement, unknown>()
    behavior.filter((e) => {
      if (!interactive) return false
      if (filter) return filter(e)
      return e.button === 0
    })
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
