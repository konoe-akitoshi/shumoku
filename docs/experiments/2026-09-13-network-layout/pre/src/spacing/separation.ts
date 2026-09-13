import { LayoutError, LayoutInvariantError } from '../errors'
import { overlappingPairs, translate } from '../geometry/box'
import { GEOMETRY_EPSILON } from '../geometry/tolerance'
import type { Box, PerSide } from '../geometry/types'
import type { LayoutModel } from '../model'
import type { LayoutSettings } from '../options'
import { itemAt, range } from '../utils/collections'
import type { AttachmentGeometry, HaloSet } from './halo'
import { expandBox, requiredHalos } from './halo'

export interface SeparationRequest {
  readonly model: LayoutModel
  readonly nodes: readonly Box[]
  /** Node whose absolute position is restored after every sweep. */
  readonly anchor: number
  readonly settings: LayoutSettings
  /** Frames for the given node positions. */
  readonly fitFrames: (nodes: readonly Box[]) => Box[]
  /** Link endpoints and terminal sides implied by the given positions. */
  readonly attachmentsFor: (nodes: readonly Box[], frames: readonly Box[]) => AttachmentGeometry
}

export interface SeparationResult {
  readonly nodes: readonly Box[]
  readonly frames: readonly Box[]
  readonly corrections: number
  readonly passes: number
}

type Axis = 'x' | 'y'

interface HaloSnapshot {
  readonly frames: Box[]
  readonly required: HaloSet
  /** Halo boxes grown to the widest band each item has required during this separation. */
  readonly nodeEnvelopes: Box[]
  readonly groupEnvelopes: Box[]
}

interface Push {
  readonly dx: number
  readonly dy: number
  readonly firstShare: number
  readonly secondShare: number
}

/**
 * Moves whole groups until no required node or frame halo overlaps. Group interiors stay rigid.
 *
 * - Pushes use the widest band each item has needed so far, so a band that shrinks after a move
 *   cannot pull groups back into an oscillation.
 * - A group pair keeps the push axis chosen at its first contact.
 * - Only one group of a pair moves, chosen by the initial frame order, so a deficit propagates along
 *   a chain of groups instead of bouncing back and forth.
 * - The anchor node returns to its absolute position after every sweep.
 *
 * Throws when overlaps remain after `maxSeparationPasses`; an overlapping result is never returned.
 */
export function separateGroups(request: SeparationRequest): SeparationResult {
  const { model, settings } = request
  const anchorTarget = itemAt(request.nodes, request.anchor)
  const initialFrames = request.fitFrames(request.nodes)
  const nodeEnvelope = createSideEnvelope()
  const groupEnvelope = createSideEnvelope()
  const pushAxes = new Map<string, Axis>()
  let nodes: Box[] = request.nodes.map((node) => ({ ...node }))
  let corrections = 0

  const takeSnapshot = (): HaloSnapshot => {
    const frames = request.fitFrames(nodes)
    const required = requiredHalos(
      model,
      nodes,
      frames,
      request.attachmentsFor(nodes, frames),
      settings,
    )
    return {
      frames,
      required,
      nodeEnvelopes: nodes.map((node, index) =>
        expandBox(
          node,
          settings.nodeStrokeWidth,
          nodeEnvelope.widen(index, itemAt(required.nodes, index).sides),
        ),
      ),
      groupEnvelopes: frames.map((frame, index) =>
        expandBox(
          frame,
          settings.frameStrokeWidth,
          groupEnvelope.widen(index, itemAt(required.groups, index).sides),
        ),
      ),
    }
  }

  const moveGroup = (group: number, dx: number, dy: number) => {
    nodes = nodes.map((node, index) =>
      itemAt(model.nodes, index).group === group ? translate(node, dx, dy) : node,
    )
  }

  const restoreAnchor = () => {
    const current = itemAt(nodes, request.anchor)
    const dx = anchorTarget.x - current.x
    const dy = anchorTarget.y - current.y
    nodes = nodes.map((node) => translate(node, dx, dy))
  }

  const pushApart = (first: Box, second: Box, firstGroup: number, secondGroup: number) => {
    const overlapX = (first.w + second.w) / 2 - Math.abs(first.x - second.x)
    const overlapY = (first.h + second.h) / 2 - Math.abs(first.y - second.y)
    if (overlapX <= GEOMETRY_EPSILON || overlapY <= GEOMETRY_EPSILON) return null
    const firstReference = itemAt(initialFrames, firstGroup)
    const secondReference = itemAt(initialFrames, secondGroup)
    const signX = Math.sign(firstReference.x - secondReference.x || firstGroup - secondGroup)
    const signY = Math.sign(firstReference.y - secondReference.y || firstGroup - secondGroup)
    const travelX =
      signX > 0
        ? second.x + second.w / 2 - (first.x - first.w / 2)
        : first.x + first.w / 2 - (second.x - second.w / 2)
    const travelY =
      signY > 0
        ? second.y + second.h / 2 - (first.y - first.h / 2)
        : first.y + first.h / 2 - (second.y - second.h / 2)
    const pairKey = `${Math.min(firstGroup, secondGroup)}:${Math.max(firstGroup, secondGroup)}`
    const axis: Axis = pushAxes.get(pairKey) ?? (travelX < travelY ? 'x' : 'y')
    pushAxes.set(pairKey, axis)
    const dx = axis === 'x' ? signX * travelX : 0
    const dy = axis === 'y' ? signY * travelY : 0
    const firstShare = (axis === 'x' ? signX : signY) > 0 ? 1 : 0
    const secondShare = 1 - firstShare
    moveGroup(firstGroup, dx * firstShare, dy * firstShare)
    moveGroup(secondGroup, -dx * secondShare, -dy * secondShare)
    corrections += 1
    const push: Push = { dx, dy, firstShare, secondShare }
    return push
  }

  let snapshot = takeSnapshot()
  for (const pass of range(settings.maxSeparationPasses)) {
    let groupBoxes = snapshot.groupEnvelopes
    for (const { first, second } of overlappingPairs(snapshot.groupEnvelopes)) {
      const push = pushApart(itemAt(groupBoxes, first), itemAt(groupBoxes, second), first, second)
      if (push === null) continue
      groupBoxes = groupBoxes.map((box, index) => {
        if (index === first)
          return translate(box, push.dx * push.firstShare, push.dy * push.firstShare)
        if (index === second)
          return translate(box, -push.dx * push.secondShare, -push.dy * push.secondShare)
        return box
      })
    }
    restoreAnchor()
    snapshot = takeSnapshot()

    // A busy device's band can reach past its own frame band into a neighboring group.
    for (const { first, second } of overlappingPairs(snapshot.nodeEnvelopes)) {
      const firstGroup = itemAt(model.nodes, first).group
      const secondGroup = itemAt(model.nodes, second).group
      if (firstGroup === secondGroup) continue
      pushApart(
        itemAt(snapshot.nodeEnvelopes, first),
        itemAt(snapshot.nodeEnvelopes, second),
        firstGroup,
        secondGroup,
      )
      restoreAnchor()
      snapshot = takeSnapshot()
    }

    if (isSeparated(snapshot.required)) {
      const anchored = itemAt(nodes, request.anchor)
      if (anchored.x !== anchorTarget.x || anchored.y !== anchorTarget.y)
        throw new LayoutInvariantError('Group separation moved the anchor node')
      return { nodes, frames: snapshot.frames, corrections, passes: pass + 1 }
    }
  }
  throw new LayoutError(
    `Group halos still overlap after ${settings.maxSeparationPasses} separation passes`,
  )
}

function isSeparated(halos: HaloSet): boolean {
  return (
    overlappingPairs(halos.nodes.map((halo) => halo.box)).length === 0 &&
    overlappingPairs(halos.groups.map((halo) => halo.box)).length === 0
  )
}

/** Remembers, per item, the widest band ever required on each side. */
function createSideEnvelope() {
  const widest: PerSide<number>[] = []
  return {
    widen(index: number, sides: PerSide<number>): PerSide<number> {
      const previous = widest[index] ?? sides
      const next: PerSide<number> = {
        left: Math.max(previous.left, sides.left),
        right: Math.max(previous.right, sides.right),
        top: Math.max(previous.top, sides.top),
        bottom: Math.max(previous.bottom, sides.bottom),
      }
      widest[index] = next
      return next
    },
  }
}
