import { routeBoundaryConnections, segmentHits } from './tmp-test6-v7-boundary-routing.mjs'
import { boundaryTerminals } from './tmp-test6-v7-boundary-search.mjs'
import {
  connectionHalos,
  directionalHalo,
  haloProfiles,
  measureConnectionHaloSpacing,
} from './tmp-test6-v8-connection-halo.mjs'
import { measureWires } from './tmp-test6-v8-dynamic-avoidance.mjs'
import { measuredInsets } from './tmp-test6-v8-elastic-frames.mjs'
import { projectHardHalos } from './tmp-test6-v8-hard-halo.mjs'
import { measureLineAvoidance } from './tmp-test6-v8-line-avoidance.mjs'

const seq = (n) => Array.from({ length: n }, (_, i) => i)
const port = (n, side) => ({
  x: n.x + (side === 'left' ? -n.w / 2 : side === 'right' ? n.w / 2 : 0),
  y: n.y + (side === 'top' ? -n.h / 2 : side === 'bottom' ? n.h / 2 : 0),
})

// A small visibility graph for each interior segment. Mandatory virtual-node
// waypoints remain in the link; this only connects those points around real boxes.
export function interiorPath(a, b, nodes, frame, owners, clearance) {
  const obstacles = nodes.map((n) => {
    const pad = owners.has(n.id) ? 0 : clearance
    return {
      left: n.x - n.w / 2 - pad,
      right: n.x + n.w / 2 + pad,
      top: n.y - n.h / 2 - pad,
      bottom: n.y + n.h / 2 + pad,
    }
  })
  const visible = (p, q) => !obstacles.some((r) => segmentHits(p, q, r))
  if (visible(a, b)) return [a, b]
  const ps = [a, b]
  for (const r of obstacles)
    for (const [x, y] of [
      [r.left, r.top],
      [r.right, r.top],
      [r.left, r.bottom],
      [r.right, r.bottom],
    ]) {
      if (
        x < frame.x - frame.w / 2 ||
        x > frame.x + frame.w / 2 ||
        y < frame.y - frame.h / 2 ||
        y > frame.y + frame.h / 2
      )
        continue
      if (
        !obstacles.some(
          (o) => x > o.left + 1e-6 && x < o.right - 1e-6 && y > o.top + 1e-6 && y < o.bottom - 1e-6,
        )
      )
        ps.push({ x, y })
    }
  const ds = ps.map(() => Infinity),
    previous = ps.map(() => -1),
    seen = new Set()
  ds[0] = 0
  for (const _ of ps) {
    let i = -1
    for (const j of seq(ps.length)) if (!seen.has(j) && (i < 0 || ds[j] < ds[i])) i = j
    if (i < 0 || !Number.isFinite(ds[i])) break
    if (i === 1) {
      const path = []
      while (i !== -1) {
        path.push(ps[i])
        i = previous[i]
      }
      return path.reverse()
    }
    seen.add(i)
    for (const j of seq(ps.length))
      if (!seen.has(j) && visible(ps[i], ps[j])) {
        const d = ds[i] + Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y)
        if (d < ds[j]) {
          ds[j] = d
          previous[j] = i
        }
      }
  }
  throw new Error('No interior route through virtual node')
}

export function layoutVirtualRows(baseline, display, { areaRatio = 0.1 } = {}) {
  const { nodeStroke, frameStroke, wireWidth } = baseline.avoidance.options
  const clearance = (nodeStroke + wireWidth) / 2,
    wireSlot = wireWidth + 2 * clearance
  const insets = measuredInsets(display),
    links = baseline.links
  const root = baseline.nodes.findIndex((n) => n.id === 'test:internet')
  const groupOf = new Map(baseline.groups.flatMap((g, gi) => g.members.map((i) => [i, gi])))
  const rows = baseline.groups.map((g) =>
    [...new Set(g.members.map((i) => display.nodes[i].depth))]
      .sort((a, b) => a - b)
      .map((depth) => ({
        depth,
        members: g.members
          .filter((i) => display.nodes[i].depth === depth)
          .sort((a, b) => display.nodes[a].x - display.nodes[b].x),
        items: [],
        y: 0,
        h: Math.max(
          ...g.members
            .filter((i) => display.nodes[i].depth === depth)
            .map((i) => display.nodes[i].h),
        ),
      })),
  )
  const rowOf = new Map(
    rows.flatMap((rs, gi) => rs.flatMap((r, ri) => r.members.map((i) => [i, { gi, ri }]))),
  )
  const initialTerminals = boundaryTerminals(baseline.groups, links, baseline.nodes)
  const initialLookup = new Map(initialTerminals.map((t) => [`${t.li}:${t.end}`, t]))
  const plans = [],
    virtual = [],
    sides = links.map(() => ({}))
  const counts = baseline.nodes.map(() => ({ left: 0, right: 0, top: 0, bottom: 0 }))
  const addPlan = (li, end, a, b = null) => {
    const { gi, ri } = rowOf.get(a),
      rs = rows[gi]
    const n = display.nodes[a],
      g = display.groups[gi]
    const target = b === null ? initialLookup.get(`${li}:${end}`) : null
    const targetRow =
      b === null
        ? target.side === 'top'
          ? -1
          : target.side === 'bottom'
            ? rs.length
            : ri
        : rowOf.get(b).ri
    let side,
      peer = false
    if (b !== null && targetRow === ri) {
      const ia = rs[ri].members.indexOf(a),
        ib = rs[ri].members.indexOf(b)
      peer = Math.abs(ia - ib) > 1
      side = peer ? 'top' : ia < ib ? 'right' : 'left'
    } else
      side =
        targetRow < ri
          ? 'top'
          : targetRow > ri
            ? 'bottom'
            : target.y < baseline.nodes[a].y
              ? 'top'
              : 'bottom'
    sides[li][end] = side
    counts[a][side]++
    const p = { li, end, a, b, gi, ri, targetRow, side, peer, dummies: [] }
    const towardX = b === null ? target.x - baseline.groups[gi].x : display.nodes[b].x - g.x
    const sourceX = n.x - g.x
    const intermediate = seq(rs.length).filter(
      (r) => r > Math.min(ri, targetRow) && r < Math.max(ri, targetRow),
    )
    if (targetRow < ri) intermediate.reverse()
    // Internal links are traversed once, a -> b; the b plan only declares its port.
    if (b === null || end === 'a')
      for (const r of intermediate) {
        const fraction = Math.abs(r - ri) / Math.abs(targetRow - ri)
        const item = {
          id: `virtual:${li}:${end}:${r}`,
          li,
          end,
          gi,
          ri: r,
          kind: 'row-transit',
          ideal: sourceX + (towardX - sourceX) * fraction,
          w: wireSlot,
          h: rs[r].h,
          x: 0,
          y: 0,
        }
        virtual.push(item)
        rs[r].items.push(item)
        p.dummies.push(item.id)
      }
    plans.push(p)
  }
  for (const [li, l] of links.entries()) {
    addPlan(li, 'a', l.a, l.ga === l.gb ? l.b : null)
    addPlan(li, 'b', l.b, l.ga === l.gb ? l.a : null)
  }
  const nodeHalos = baseline.nodes.map((n, i) =>
    directionalHalo(n, nodeStroke, areaRatio, counts[i]),
  )
  const nodes = baseline.nodes.map((n, i) => ({ ...n, depth: display.nodes[i].depth }))
  for (const [gi, rs] of rows.entries()) {
    for (const r of rs) {
      r.items.push(
        ...r.members.map((i) => ({
          id: nodes[i].id,
          kind: 'real',
          index: i,
          ideal: display.nodes[i].x - display.groups[gi].x,
          w: nodes[i].w,
          h: nodes[i].h,
        })),
      )
      r.items.sort((a, b) => a.ideal - b.ideal || a.id.localeCompare(b.id))
      let cursor = 0
      for (const item of r.items) {
        const halo = item.kind === 'real' ? nodeHalos[item.index].sides : { left: 0, right: 0 }
        item.x = cursor + item.w / 2 + halo.left + (item.kind === 'real' ? nodeStroke / 2 : 0)
        cursor = item.x + item.w / 2 + halo.right + (item.kind === 'real' ? nodeStroke / 2 : 0)
      }
      const shift =
        r.items.filter((i) => i.kind === 'real').reduce((s, i) => s + i.ideal - i.x, 0) /
        r.members.length
      for (const item of r.items) item.x += shift
    }
    for (const [ri, r] of rs.entries()) {
      if (ri) {
        const prev = rs[ri - 1]
        const below = Math.max(...prev.members.map((i) => nodeHalos[i].sides.bottom))
        const above = Math.max(...r.members.map((i) => nodeHalos[i].sides.top))
        r.y = prev.y + prev.h / 2 + r.h / 2 + Math.max(wireSlot, below + above + nodeStroke)
      }
    }
    const centre = (rs[0].y - rs[0].h / 2 + rs.at(-1).y + rs.at(-1).h / 2) / 2
    for (const r of rs) {
      r.y -= centre
      for (const item of r.items) {
        item.x += baseline.groups[gi].x
        item.y = r.y + baseline.groups[gi].y
        if (item.kind === 'real') {
          nodes[item.index].x = item.x
          nodes[item.index].y = item.y
        }
      }
      r.y += baseline.groups[gi].y
    }
  }
  // Shift the root group once to retain the user-specified absolute Internet anchor.
  const rootGroup = groupOf.get(root),
    anchorDy = baseline.nodes[root].y - nodes[root].y,
    anchorDx = baseline.nodes[root].x - nodes[root].x
  for (const i of baseline.groups[rootGroup].members) {
    nodes[i].x += anchorDx
    nodes[i].y += anchorDy
  }
  for (const r of rows[rootGroup]) {
    r.y += anchorDy
    for (const item of r.items) {
      item.x += anchorDx
      item.y += anchorDy
    }
  }
  const packed = nodes.map((n) => ({ ...n }))
  const offset = (ps, gi) => {
    const i = baseline.groups[gi].members[0]
    return { x: ps[i].x - packed[i].x, y: ps[i].y - packed[i].y }
  }
  const movedDummy = (d, ps) => {
    const delta = offset(ps, d.gi)
    return { ...d, x: d.x + delta.x, y: d.y + delta.y }
  }
  const fitVirtualFrames = (gs, ps) =>
    gs.map((g, gi) => {
      const items = [
          ...g.members.map((i) => ps[i]),
          ...virtual.filter((d) => d.gi === gi).map((d) => movedDummy(d, ps)),
        ],
        inset = insets[gi]
      const left = Math.min(...items.map((n) => n.x - n.w / 2)) - inset.left,
        right = Math.max(...items.map((n) => n.x + n.w / 2)) + inset.right,
        top = Math.min(...items.map((n) => n.y - n.h / 2)) - inset.top,
        bottom = Math.max(...items.map((n) => n.y + n.h / 2)) + inset.bottom
      const x = (left + right) / 2,
        y = (top + bottom) / 2
      return {
        ...g,
        x,
        y,
        w: right - left,
        h: bottom - top,
        radius: Math.hypot(x, y),
        angleRadians: Math.atan2(y, x),
      }
    })
  const endpointProvider = (ps, gs) => ({
    terminals: boundaryTerminals(gs, links, ps),
    links: links.map((l, li) => ({
      ...l,
      points: [port(ps[l.a], sides[li].a), port(ps[l.b], sides[li].b)],
    })),
  })
  const geometry = projectHardHalos(nodes, {
    groups: baseline.groups,
    links,
    insets,
    root,
    nodeStroke,
    frameStroke,
    areaRatio,
    fitFrames: fitVirtualFrames,
    rigidInteriors: true,
    endpointProvider,
  })
  if (!geometry) throw new Error('Could not separate required group bands while retaining rows')
  const ps = geometry.nodes,
    gs = geometry.groups
  const terminals = boundaryTerminals(gs, links, ps),
    lookup = new Map(terminals.map((t) => [`${t.li}:${t.end}`, t]))
  const routed = routeBoundaryConnections({
    groups: gs,
    nodes: ps,
    links,
    positions: ps,
    terminals,
  })
  const dummyMap = new Map(virtual.map((d) => [d.id, movedDummy(d, ps)]))
  const virtualNodes = [...dummyMap.values()]
  const routeThrough = (targets, gi, owners) => {
    const points = [targets[0]]
    for (const [i, p] of targets.entries())
      if (i)
        points.push(
          ...interiorPath(
            targets[i - 1],
            p,
            gs[gi].members.map((n) => ps[n]),
            gs[gi],
            owners,
            clearance,
          ).slice(1),
        )
    return points.filter(
      (p, i) => !i || Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y) > 1e-7,
    )
  }
  const planMap = new Map(plans.map((p) => [`${p.li}:${p.end}`, p]))
  const interiorTargets = (p) => {
    const n = ps[p.a],
      delta = offset(ps, p.gi),
      r = rows[p.gi][p.ri],
      upward = p.side === 'top'
    const targets = [port(n, p.side)]
    if (p.side === 'top' || p.side === 'bottom')
      targets.push({ x: n.x, y: r.y + delta.y + (upward ? -1 : 1) * (r.h / 2 + clearance) })
    for (const id of p.dummies) {
      const d = dummyMap.get(id)
      targets.push(
        { x: d.x, y: d.y + ((upward ? 1 : -1) * d.h) / 2 },
        { x: d.x, y: d.y + ((upward ? -1 : 1) * d.h) / 2 },
      )
    }
    return targets
  }
  const newLinks = links.map((l, li) => {
    const a = planMap.get(`${li}:a`),
      b = planMap.get(`${li}:b`),
      owners = new Set([ps[l.a].id, ps[l.b].id])
    if (l.ga === l.gb) {
      const targets = interiorTargets(a)
      if (a.peer) {
        const laneY = targets.at(-1).y,
          x = (ps[l.a].x + ps[l.b].x) / 2
        const v = {
          id: `virtual:${li}:peer`,
          kind: 'peer-lane',
          gi: l.ga,
          li,
          x,
          y: laneY,
          w: wireSlot,
          h: wireSlot,
        }
        virtualNodes.push(v)
        targets.push({ x, y: laneY }, { x: ps[l.b].x, y: laneY })
      }
      targets.push(port(ps[l.b], b.side))
      return {
        ...l,
        crossGroup: false,
        points: routeThrough(targets, l.ga, owners),
        virtualIds: [...a.dummies, ...(a.peer ? [`virtual:${li}:peer`] : [])],
      }
    }
    const exit = lookup.get(`${li}:a`),
      entry = lookup.get(`${li}:b`)
    const sourceTargets = [...interiorTargets(a), { x: exit.x, y: exit.y }]
    const targetTargets = [...interiorTargets(b), { x: entry.x, y: entry.y }]
    const sourcePath = routeThrough(sourceTargets, l.ga, owners),
      targetPath = routeThrough(targetTargets, l.gb, owners).reverse()
    const exterior = routed[li].points.slice(1, -1)
    return {
      ...l,
      crossGroup: true,
      points: [...sourcePath, ...exterior.slice(1), ...targetPath.slice(1)],
      exit: { x: exit.x, y: exit.y },
      entry: { x: entry.x, y: entry.y },
      virtualIds: [...a.dummies, ...b.dummies],
    }
  })
  const resultNodes = ps.map((n, i) => {
    const g = gs[groupOf.get(i)]
    return { ...n, localX: n.x - g.x, localY: n.y - g.y }
  })
  const measure = (ns, gl, ls, ts) => ({
    ...measureLineAvoidance(ns, ls, clearance),
    ...measureWires(ls),
    ...measureConnectionHaloSpacing(ns, gl, ls, ts, nodeStroke, frameStroke, areaRatio),
  })
  const metrics = measure(resultNodes, gs, newLinks, terminals)
  return {
    nodes: resultNodes,
    groups: gs,
    links: newLinks,
    terminals,
    virtualNodes,
    rows: rows.map((rs, gi) =>
      rs.map((r) => ({ depth: r.depth, members: r.members, y: r.y + offset(ps, gi).y })),
    ),
    before: measure(baseline.nodes, baseline.groups, baseline.links, baseline.terminals),
    metrics,
    model:
      'Restore one horizontal row per original depth; remove independent line-avoidance node displacement. Real nodes and per-link transit dummies share row packing. Peer links use a wire-only outside-row lane. Interior visibility routing joins mandatory virtual waypoints without moving real nodes. Required connection-derived bands retained; macro projection translates whole groups only. No wrapping, role tiers or frame size caps.',
    options: {
      areaRatio,
      nodeStroke,
      frameStroke,
      wireWidth,
      clearance,
      wireSlot,
      insets,
      rigidInteriors: true,
    },
    haloProfiles: {
      after: haloProfiles(
        connectionHalos(resultNodes, gs, newLinks, terminals, nodeStroke, frameStroke, areaRatio),
      ),
    },
    trace: [],
    evaluations: 1,
    moved: resultNodes.flatMap((n, i) => {
      const dx = n.x - baseline.nodes[i].x,
        dy = n.y - baseline.nodes[i].y
      return Math.hypot(dx, dy) > 1e-6 ? [{ id: n.id, dx, dy, distance: Math.hypot(dx, dy) }] : []
    }),
  }
}
