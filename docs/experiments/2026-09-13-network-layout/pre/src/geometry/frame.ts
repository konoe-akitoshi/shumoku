import { boxFromBounds } from './box'
import type { Bounds, Box, Insets } from './types'

/** The frame that encloses all `contents` with `padding` between them and the frame edge. */
export function fitFrameAround(contents: readonly Bounds[], padding: Insets): Box {
  return boxFromBounds({
    left: Math.min(...contents.map((bounds) => bounds.left)) - padding.left,
    right: Math.max(...contents.map((bounds) => bounds.right)) + padding.right,
    top: Math.min(...contents.map((bounds) => bounds.top)) - padding.top,
    bottom: Math.max(...contents.map((bounds) => bounds.bottom)) + padding.bottom,
  })
}
