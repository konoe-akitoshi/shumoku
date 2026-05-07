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
  /** Fires once when the user starts dragging — use to open an undo/sync transaction. */
  onStart?: () => void
  onDrag: (dx: number, dy: number) => void
  /** Fires once on release — use to close the transaction and persist the result. */
  onEnd?: () => void
}

/** Generic drag action for any SVG element (nodes, subgraphs, etc.) */
export function elementDrag(element: SVGElement, opts: () => DragOptions) {
  function apply() {
    const { interactive = true, filter, onStart, onDrag, onEnd } = opts()
    const behavior = drag<SVGElement, unknown>()
    behavior.filter((e) => {
      if (!interactive) return false
      if (filter) return filter(e)
      return e.button === 0
    })
    behavior.on('start', () => onStart?.())
    behavior.on('drag', (e) => onDrag(e.dx, e.dy))
    behavior.on('end', () => onEnd?.())
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
