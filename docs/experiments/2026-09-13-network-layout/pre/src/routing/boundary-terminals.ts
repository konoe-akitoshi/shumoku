import type { Box, Point, Side } from '../geometry/types'
import { runsHorizontally, SIDES } from '../geometry/types'
import type { LayoutModel, LinkEnd } from '../model'
import { endGroup, endNode, LINK_ENDS, oppositeEnd } from '../model'
import { itemAt, mapValue, range } from '../utils/collections'

/** Where a cross-group link passes through the frame of one of its groups. */
export interface BoundaryTerminal extends Point {
  readonly link: number
  readonly end: LinkEnd
  readonly group: number
  readonly node: number
  readonly side: Side
  /** Position along the side where the straight center-to-center ray meets the frame. */
  readonly ideal: number
}

/** Terminals keep this distance from frame corners. */
const CORNER_MARGIN = 18
/** Upper bound on the spacing between neighboring terminals on one side. */
const MAX_TERMINAL_SPACING = 10

type TerminalDraft = Omit<BoundaryTerminal, 'x' | 'y'>

/**
 * Places one terminal per cross-group link end. The frame side is where the ray from the node toward
 * the peer node leaves the frame; terminals on one side keep the order of their ideal positions and
 * are spread apart without leaving the side.
 */
export function placeBoundaryTerminals(
  model: LayoutModel,
  frames: readonly Box[],
  positions: readonly Point[],
): BoundaryTerminal[] {
  const drafts = model.links.flatMap((link, linkIndex) =>
    link.crossGroup
      ? LINK_ENDS.map((end) => {
          const group = endGroup(link, end)
          const node = endNode(link, end)
          return draftTerminal(
            { link: linkIndex, end, group, node },
            itemAt(frames, group),
            itemAt(positions, node),
            itemAt(positions, endNode(link, oppositeEnd(end))),
          )
        })
      : [],
  )
  const placed = new Map<TerminalDraft, Point>()
  for (const [group, frame] of frames.entries())
    for (const side of SIDES) {
      const onSide = drafts
        .filter((draft) => draft.group === group && draft.side === side)
        .sort((a, b) => a.ideal - b.ideal || a.node - b.node || a.link - b.link)
      const along = spreadAlongSide(
        onSide.map((draft) => draft.ideal),
        frame,
        side,
      )
      for (const [index, draft] of onSide.entries())
        placed.set(draft, pointOnSide(frame, side, itemAt(along, index)))
    }
  return drafts.map((draft) => ({ ...draft, ...mapValue(placed, draft) }))
}

function draftTerminal(
  identity: Pick<TerminalDraft, 'link' | 'end' | 'group' | 'node'>,
  frame: Box,
  from: Point,
  toward: Point,
): TerminalDraft {
  const dx = toward.x - from.x
  const dy = toward.y - from.y
  const toVerticalSide =
    Math.abs(dx) > 1e-9
      ? (frame.x + ((dx > 0 ? 1 : -1) * frame.w) / 2 - from.x) / dx
      : Number.POSITIVE_INFINITY
  const toHorizontalSide =
    Math.abs(dy) > 1e-9
      ? (frame.y + ((dy > 0 ? 1 : -1) * frame.h) / 2 - from.y) / dy
      : Number.POSITIVE_INFINITY
  const exitsSideways = toVerticalSide < toHorizontalSide
  const travel = Math.min(toVerticalSide, toHorizontalSide)
  return {
    ...identity,
    side: exitsSideways ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'bottom' : 'top',
    ideal: exitsSideways ? from.y + travel * dy : from.x + travel * dx,
  }
}

/** Clamps sorted ideal positions into the side, then pushes neighbors apart forward and back. */
function spreadAlongSide(ideals: readonly number[], frame: Box, side: Side): number[] {
  if (ideals.length === 0) return []
  const horizontal = runsHorizontally(side)
  const center = horizontal ? frame.x : frame.y
  const extent = horizontal ? frame.w : frame.h
  const low = center - extent / 2 + CORNER_MARGIN
  const high = center + extent / 2 - CORNER_MARGIN
  const spacing = Math.min(MAX_TERMINAL_SPACING, (high - low) / Math.max(1, ideals.length - 1))
  const along = ideals.map((ideal) => Math.max(low, Math.min(high, ideal)))
  for (const index of range(along.length).slice(1))
    along[index] = Math.max(itemAt(along, index), itemAt(along, index - 1) + spacing)
  const last = along.length - 1
  if (itemAt(along, last) > high) {
    along[last] = high
    for (const index of range(last).reverse())
      along[index] = Math.min(itemAt(along, index), itemAt(along, index + 1) - spacing)
  }
  return along
}

function pointOnSide(frame: Box, side: Side, along: number): Point {
  return runsHorizontally(side)
    ? { x: along, y: frame.y + ((side === 'bottom' ? 1 : -1) * frame.h) / 2 }
    : { x: frame.x + ((side === 'right' ? 1 : -1) * frame.w) / 2, y: along }
}
