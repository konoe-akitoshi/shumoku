import { boundsOf, sideMidpoint, translate } from '../geometry/box'
import { fitFrameAround } from '../geometry/frame'
import { toPoint } from '../geometry/point'
import { ROUTE_POINT_MERGE_TOLERANCE } from '../geometry/tolerance'
import type { Box, PerSide, Point, Side } from '../geometry/types'
import { runsHorizontally } from '../geometry/types'
import type { LayoutModel, LinkEnd, ModelLink } from '../model'
import { endNode, LINK_ENDS, linkEndKey, oppositeEnd } from '../model'
import type { LayoutSettings } from '../options'
import type { BoundaryTerminal } from '../routing/boundary-terminals'
import { placeBoundaryTerminals } from '../routing/boundary-terminals'
import { createExteriorRouter } from '../routing/exterior'
import { memberObstacles, routeThroughWaypoints } from '../routing/interior'
import type { DirectionalHalo } from '../spacing/halo'
import { directionalHalo } from '../spacing/halo'
import { separateGroups } from '../spacing/separation'
import type { LayoutState, Route, Row, TransitSlot } from '../state'
import { firstItem, itemAt, lastItem, mapValue, range } from '../utils/collections'

/**
 * Stage 1 — row packing.
 *
 * Devices of a group are stacked in rows by upstream distance (one row per distinct distance, no empty
 * rows) and keep their preferred left-to-right order. A link crossing intermediate rows reserves a
 * thin transit slot in each, so wires never push devices out of their row. Horizontal packing and row
 * spacing come from the required halos. Whole groups are then separated and every link is routed
 * through its transit slots.
 */

export interface RowPackingResult extends LayoutState {
  readonly transits: readonly TransitSlot[]
}

interface RowDraft {
  readonly rank: number
  readonly members: readonly number[]
  readonly height: number
}

interface NodeSlot {
  readonly group: number
  readonly row: number
}

/** Where the other end of a link lies, seen from one end inside its group. */
type Destination =
  | { readonly kind: 'node'; readonly node: number; readonly row: number; readonly offsetX: number }
  | {
      readonly kind: 'terminal'
      readonly terminal: BoundaryTerminal
      /** -1 above the first row, `rows.length` below the last row, or the node's own row. */
      readonly row: number
      readonly offsetX: number
    }

/** How one end of a link leaves its node. */
interface EndPlan {
  readonly node: number
  readonly group: number
  readonly row: number
  readonly side: Side
  /** A same-row link to a non-adjacent node leaves upward and runs through a wire-only lane. */
  readonly peer: boolean
  readonly transitIds: readonly string[]
}

interface TransitDraft {
  readonly id: string
  readonly link: number
  readonly group: number
  readonly row: number
  /** Preferred X relative to the seed frame center, interpolated between the link's ends. */
  readonly ideal: number
  readonly w: number
  readonly h: number
}

type RowItem =
  | {
      readonly kind: 'node'
      readonly id: string
      readonly node: number
      readonly ideal: number
      readonly w: number
    }
  | { readonly kind: 'transit'; readonly id: string; readonly ideal: number; readonly w: number }

const NO_HALO: PerSide<number> = { left: 0, right: 0, top: 0, bottom: 0 }

export function packRows(
  model: LayoutModel,
  distances: readonly (number | null)[],
  anchor: number,
  settings: LayoutSettings,
): RowPackingResult {
  const rows = assignRows(model, distances)
  const { plans, transits: transitDrafts } = planLinkEnds(model, rows, settings)
  const planOf = (link: number, end: LinkEnd) => mapValue(plans, linkEndKey(link, end))
  const halos = nodeHalos(model, [...plans.values()], settings)
  const packed = packGroups(model, rows, transitDrafts, halos, anchor, settings)

  const offsetOf = (nodes: readonly Box[], group: number): Point => {
    const member = firstItem(itemAt(model.groups, group).members)
    const now = itemAt(nodes, member)
    const before = itemAt(packed.nodes, member)
    return { x: now.x - before.x, y: now.y - before.y }
  }
  const transitAt = (nodes: readonly Box[], transit: TransitSlot): TransitSlot => {
    const offset = offsetOf(nodes, transit.group)
    return translate(transit, offset.x, offset.y)
  }

  const separated = separateGroups({
    model,
    nodes: packed.nodes,
    anchor,
    settings,
    fitFrames: (nodes) =>
      model.groups.map((group, index) =>
        fitFrameAround(
          [
            ...group.members.map((member) => boundsOf(itemAt(nodes, member))),
            ...packed.transits
              .filter((transit) => transit.group === index)
              .map((transit) => boundsOf(transitAt(nodes, transit))),
          ],
          group.padding,
        ),
      ),
    attachmentsFor: (nodes, frames) => ({
      terminals: placeBoundaryTerminals(model, frames, nodes),
      endpoints: model.links.map((link, index) => ({
        source: sideMidpoint(itemAt(nodes, link.source), planOf(index, 'source').side),
        target: sideMidpoint(itemAt(nodes, link.target), planOf(index, 'target').side),
      })),
    }),
  })

  const { nodes, frames } = separated
  const terminals = placeBoundaryTerminals(model, frames, nodes)
  const terminalOf = new Map(terminals.map((t) => [linkEndKey(t.link, t.end), t]))
  const routeExterior = createExteriorRouter(frames, terminals)
  const rowTransits = packed.transits.map((transit) => transitAt(nodes, transit))
  const transitById = new Map(rowTransits.map((transit) => [transit.id, transit]))
  const finalRows: Row[][] = rows.map((groupRows, group) =>
    groupRows.map((row, rank) => ({
      rank: row.rank,
      members: row.members,
      y: itemAt(itemAt(packed.rowY, group), rank) + offsetOf(nodes, group).y,
    })),
  )

  const waypointsLeaving = (plan: EndPlan): Point[] => {
    const node = itemAt(nodes, plan.node)
    const upward = plan.side === 'top'
    const waypoints: Point[] = [sideMidpoint(node, plan.side)]
    if (runsHorizontally(plan.side)) {
      const rowY = itemAt(itemAt(finalRows, plan.group), plan.row).y
      const rowHeight = itemAt(itemAt(rows, plan.group), plan.row).height
      waypoints.push({
        x: node.x,
        y: rowY + (upward ? -1 : 1) * (rowHeight / 2 + settings.clearance),
      })
    }
    for (const id of plan.transitIds) {
      const transit = mapValue(transitById, id)
      waypoints.push(
        { x: transit.x, y: transit.y + ((upward ? 1 : -1) * transit.h) / 2 },
        { x: transit.x, y: transit.y + ((upward ? -1 : 1) * transit.h) / 2 },
      )
    }
    return waypoints
  }

  const routeInGroup = (waypoints: readonly Point[], group: number, link: ModelLink) =>
    routeThroughWaypoints(
      waypoints,
      memberObstacles(
        nodes,
        itemAt(model.groups, group).members,
        new Set([link.source, link.target]),
        settings.clearance,
      ),
      itemAt(frames, group),
      ROUTE_POINT_MERGE_TOLERANCE,
    )

  const peerLanes: TransitSlot[] = []
  const routes = model.links.map((link, index): Route => {
    const source = planOf(index, 'source')
    const target = planOf(index, 'target')
    if (!link.crossGroup) {
      const waypoints = waypointsLeaving(source)
      if (source.peer) {
        const laneY = lastItem(waypoints).y
        const targetNode = itemAt(nodes, link.target)
        const x = (itemAt(nodes, link.source).x + targetNode.x) / 2
        peerLanes.push({
          id: `virtual:${index}:peer`,
          kind: 'peer-lane',
          link: index,
          group: link.sourceGroup,
          x,
          y: laneY,
          w: settings.transitWidth,
          h: settings.transitWidth,
        })
        waypoints.push({ x, y: laneY }, { x: targetNode.x, y: laneY })
      }
      waypoints.push(sideMidpoint(itemAt(nodes, link.target), target.side))
      return { kind: 'internal', points: routeInGroup(waypoints, link.sourceGroup, link) }
    }
    const exit = toPoint(mapValue(terminalOf, linkEndKey(index, 'source')))
    const entry = toPoint(mapValue(terminalOf, linkEndKey(index, 'target')))
    const sourcePath = routeInGroup([...waypointsLeaving(source), exit], link.sourceGroup, link)
    const targetPath = routeInGroup(
      [...waypointsLeaving(target), entry],
      link.targetGroup,
      link,
    ).reverse()
    return {
      kind: 'cross-group',
      points: [...sourcePath, ...routeExterior(index).slice(1), ...targetPath.slice(1)],
      exit,
      entry,
    }
  })

  return {
    nodes,
    frames,
    terminals,
    routes,
    rows: finalRows,
    transits: [...rowTransits, ...peerLanes],
  }
}

/** One row per distinct upstream distance; nodes without a distance share a final row. */
function assignRows(model: LayoutModel, distances: readonly (number | null)[]): RowDraft[][] {
  return model.groups.map((group) => {
    const levels = distinctLevels(group.members.map((member) => itemAt(distances, member)))
    return levels.map((level, rank) => {
      const members = group.members
        .filter((member) => itemAt(distances, member) === level)
        .sort(
          (a, b) =>
            itemAt(model.nodes, a).preferredOffsetX - itemAt(model.nodes, b).preferredOffsetX,
        )
      return {
        rank,
        members,
        height: Math.max(...members.map((member) => itemAt(model.nodes, member).h)),
      }
    })
  })
}

function distinctLevels(values: readonly (number | null)[]): (number | null)[] {
  const known = [...new Set(values.filter((value): value is number => value !== null))].sort(
    (a, b) => a - b,
  )
  return values.includes(null) ? [...known, null] : known
}

function planLinkEnds(
  model: LayoutModel,
  rows: readonly (readonly RowDraft[])[],
  settings: LayoutSettings,
): { readonly plans: Map<string, EndPlan>; readonly transits: TransitDraft[] } {
  const slots = slotsOf(model, rows)
  const seedTerminals = placeBoundaryTerminals(
    model,
    model.groups.map((group) => group.seedFrame),
    model.nodes.map((node) => node.seedPosition),
  )
  const seedTerminalOf = new Map(seedTerminals.map((t) => [linkEndKey(t.link, t.end), t]))
  const plans = new Map<string, EndPlan>()
  const transits: TransitDraft[] = []

  for (const [linkIndex, link] of model.links.entries())
    for (const end of LINK_ENDS) {
      const node = endNode(link, end)
      const { group, row } = itemAt(slots, node)
      const groupRows = itemAt(rows, group)
      const destination = destinationOf({
        model,
        link,
        linkIndex,
        end,
        row,
        rowCount: groupRows.length,
        slots,
        seedTerminalOf,
      })
      const { side, peer } = exitSide(model, node, row, groupRows, destination)

      // Internal links cross intermediate rows once, from the source; each cross-group end crosses
      // the rows between its node and its terminal.
      const transitIds: string[] = []
      if (destination.kind === 'terminal' || end === 'source') {
        const crossed = range(groupRows.length).filter(
          (candidate) =>
            candidate > Math.min(row, destination.row) &&
            candidate < Math.max(row, destination.row),
        )
        if (destination.row < row) crossed.reverse()
        const startX = itemAt(model.nodes, node).preferredOffsetX
        for (const crossedRow of crossed) {
          const fraction = Math.abs(crossedRow - row) / Math.abs(destination.row - row)
          const id = `virtual:${linkIndex}:${end}:${crossedRow}`
          transits.push({
            id,
            link: linkIndex,
            group,
            row: crossedRow,
            ideal: startX + (destination.offsetX - startX) * fraction,
            w: settings.transitWidth,
            h: itemAt(groupRows, crossedRow).height,
          })
          transitIds.push(id)
        }
      }
      plans.set(linkEndKey(linkIndex, end), { node, group, row, side, peer, transitIds })
    }
  return { plans, transits }
}

interface EndContext {
  readonly model: LayoutModel
  readonly link: ModelLink
  readonly linkIndex: number
  readonly end: LinkEnd
  /** Row of the end's own node. */
  readonly row: number
  readonly rowCount: number
  readonly slots: readonly NodeSlot[]
  readonly seedTerminalOf: ReadonlyMap<string, BoundaryTerminal>
}

function destinationOf(context: EndContext): Destination {
  const { model, link, end, row } = context
  if (!link.crossGroup) {
    const peerNode = endNode(link, oppositeEnd(end))
    return {
      kind: 'node',
      node: peerNode,
      row: itemAt(context.slots, peerNode).row,
      offsetX: itemAt(model.nodes, peerNode).preferredOffsetX,
    }
  }
  // The seed terminal tells whether the link leaves above, below or beside the node's rows.
  const terminal = mapValue(context.seedTerminalOf, linkEndKey(context.linkIndex, end))
  const group = itemAt(model.groups, terminal.group)
  return {
    kind: 'terminal',
    terminal,
    row: terminal.side === 'top' ? -1 : terminal.side === 'bottom' ? context.rowCount : row,
    offsetX: terminal.x - group.seedFrame.x,
  }
}

function exitSide(
  model: LayoutModel,
  node: number,
  row: number,
  groupRows: readonly RowDraft[],
  destination: Destination,
): { readonly side: Side; readonly peer: boolean } {
  if (destination.row < row) return { side: 'top', peer: false }
  if (destination.row > row) return { side: 'bottom', peer: false }
  if (destination.kind === 'terminal') {
    const above = destination.terminal.y < itemAt(model.nodes, node).seedPosition.y
    return { side: above ? 'top' : 'bottom', peer: false }
  }
  const members = itemAt(groupRows, row).members
  const from = members.indexOf(node)
  const to = members.indexOf(destination.node)
  const peer = Math.abs(from - to) > 1
  return { side: peer ? 'top' : from < to ? 'right' : 'left', peer }
}

function slotsOf(model: LayoutModel, rows: readonly (readonly RowDraft[])[]): NodeSlot[] {
  const slots = new Map<number, NodeSlot>()
  for (const [group, groupRows] of rows.entries())
    for (const [row, draft] of groupRows.entries())
      for (const member of draft.members) slots.set(member, { group, row })
  return model.nodes.map((_, index) => mapValue(slots, index))
}

function nodeHalos(
  model: LayoutModel,
  plans: readonly EndPlan[],
  settings: LayoutSettings,
): DirectionalHalo[] {
  const counts = model.nodes.map(() => ({ left: 0, right: 0, top: 0, bottom: 0 }))
  for (const plan of plans) itemAt(counts, plan.node)[plan.side] += 1
  return model.nodes.map((node, index) =>
    directionalHalo(
      { ...node.seedPosition, w: node.w, h: node.h },
      settings.nodeStrokeWidth,
      settings.haloAreaRatio,
      itemAt(counts, index),
    ),
  )
}

interface PackedGroups {
  readonly nodes: Box[]
  readonly transits: TransitSlot[]
  /** Absolute row center Y per group and row, before group separation. */
  readonly rowY: number[][]
}

/** Packs every row inside its seed frame, then shifts the anchor's group back onto the anchor seed. */
function packGroups(
  model: LayoutModel,
  rows: readonly (readonly RowDraft[])[],
  transitDrafts: readonly TransitDraft[],
  halos: readonly DirectionalHalo[],
  anchor: number,
  settings: LayoutSettings,
): PackedGroups {
  const nodeCenters = new Map<number, Point>()
  const transitCenters = new Map<string, Point>()
  const rowY: number[][] = []
  for (const [groupIndex, group] of model.groups.entries()) {
    const groupRows = itemAt(rows, groupIndex)
    const frame = group.seedFrame
    const localY = stackRows(groupRows, halos, settings)
    for (const [rank, row] of groupRows.entries()) {
      const y = itemAt(localY, rank) + frame.y
      const inRow = transitDrafts.filter((t) => t.group === groupIndex && t.row === rank)
      const packedX = packRow(model, row, inRow, halos, settings)
      for (const [member, x] of packedX.nodes) nodeCenters.set(member, { x: x + frame.x, y })
      for (const [id, x] of packedX.transits) transitCenters.set(id, { x: x + frame.x, y })
    }
    rowY.push(localY.map((y) => y + frame.y))
  }

  const anchorNode = itemAt(model.nodes, anchor)
  const anchorCenter = mapValue(nodeCenters, anchor)
  const dx = anchorNode.seedPosition.x - anchorCenter.x
  const dy = anchorNode.seedPosition.y - anchorCenter.y
  const inAnchorGroup = (group: number) => group === anchorNode.group
  const shiftIfAnchored = (center: Point, group: number): Point =>
    inAnchorGroup(group) ? { x: center.x + dx, y: center.y + dy } : center

  return {
    nodes: model.nodes.map((node, index) => {
      const center = shiftIfAnchored(mapValue(nodeCenters, index), node.group)
      return { x: center.x, y: center.y, w: node.w, h: node.h }
    }),
    transits: transitDrafts.map((draft) => {
      const center = shiftIfAnchored(mapValue(transitCenters, draft.id), draft.group)
      return {
        id: draft.id,
        kind: 'row-transit',
        link: draft.link,
        group: draft.group,
        x: center.x,
        y: center.y,
        w: draft.w,
        h: draft.h,
      }
    }),
    rowY: rowY.map((ys, group) => (inAnchorGroup(group) ? ys.map((y) => y + dy) : ys)),
  }
}

/**
 * Places the items of one row side by side, each with its halo (devices) or bare width (transit
 * slots), then shifts the whole row so devices sit on average at their preferred X.
 */
function packRow(
  model: LayoutModel,
  row: RowDraft,
  transits: readonly TransitDraft[],
  halos: readonly DirectionalHalo[],
  settings: LayoutSettings,
): { readonly nodes: Map<number, number>; readonly transits: Map<string, number> } {
  const items: RowItem[] = [
    ...transits.map((t): RowItem => ({ kind: 'transit', id: t.id, ideal: t.ideal, w: t.w })),
    ...row.members.map((member): RowItem => {
      const node = itemAt(model.nodes, member)
      return { kind: 'node', id: node.id, node: member, ideal: node.preferredOffsetX, w: node.w }
    }),
  ].sort((a, b) => a.ideal - b.ideal || a.id.localeCompare(b.id))

  let cursor = 0
  const placed: { readonly item: RowItem; readonly x: number }[] = []
  for (const item of items) {
    const halo = item.kind === 'node' ? itemAt(halos, item.node).sides : NO_HALO
    const halfStroke = item.kind === 'node' ? settings.nodeStrokeWidth / 2 : 0
    const x = cursor + item.w / 2 + halo.left + halfStroke
    cursor = x + item.w / 2 + halo.right + halfStroke
    placed.push({ item, x })
  }
  const shift =
    placed.reduce(
      (total, { item, x }) => (item.kind === 'node' ? total + item.ideal - x : total),
      0,
    ) / row.members.length

  const nodes = new Map<number, number>()
  const transitX = new Map<string, number>()
  for (const { item, x } of placed)
    if (item.kind === 'node') nodes.set(item.node, x + shift)
    else transitX.set(item.id, x + shift)
  return { nodes, transits: transitX }
}

/** Row centers relative to the middle of the stack; gaps fit both halos and a wire transit. */
function stackRows(
  groupRows: readonly RowDraft[],
  halos: readonly DirectionalHalo[],
  settings: LayoutSettings,
): number[] {
  const centers: number[] = []
  for (const [rank, row] of groupRows.entries()) {
    if (rank === 0) {
      centers.push(0)
      continue
    }
    const previous = itemAt(groupRows, rank - 1)
    const bandBelow = Math.max(...previous.members.map((m) => itemAt(halos, m).sides.bottom))
    const bandAbove = Math.max(...row.members.map((m) => itemAt(halos, m).sides.top))
    centers.push(
      itemAt(centers, rank - 1) +
        previous.height / 2 +
        row.height / 2 +
        Math.max(settings.transitWidth, bandBelow + bandAbove + settings.nodeStrokeWidth),
    )
  }
  const first = firstItem(groupRows)
  const last = lastItem(groupRows)
  const middle = (itemAt(centers, 0) - first.height / 2 + lastItem(centers) + last.height / 2) / 2
  return centers.map((center) => center - middle)
}
