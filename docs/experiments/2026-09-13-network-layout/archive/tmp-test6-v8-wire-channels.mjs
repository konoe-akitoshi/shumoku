import { routeBoundaryConnections } from './tmp-test6-v7-boundary-routing.mjs'
import {
  connectionHalos,
  haloProfiles,
  measureConnectionHaloSpacing,
} from './tmp-test6-v8-connection-halo.mjs'
import { measureWires } from './tmp-test6-v8-dynamic-avoidance.mjs'
import { projectHardHalos } from './tmp-test6-v8-hard-halo.mjs'
import { measureLineAvoidance } from './tmp-test6-v8-line-avoidance.mjs'

const epsilon = 1e-6
const same = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < epsilon
const compact = (points) => points.filter((p, i) => !i || !same(p, points[i - 1]))

// Interval partitioning: overlapping horizontal footprints need different lanes;
// spatially disjoint spans reuse a lane. There is no global link-count multiplier.
export function allocateWireLanes(requests, pitch) {
  const occupied = [],
    assigned = []
  for (const r of [...requests].sort(
    (a, b) => a.left - b.left || a.right - b.right || a.id.localeCompare(b.id),
  )) {
    let lane = occupied.findIndex((right) => right <= r.left - pitch / 2 + epsilon)
    if (lane < 0) lane = occupied.length
    occupied[lane] = r.right + pitch / 2
    assigned.push({ ...r, lane })
  }
  return {
    requests: assigned.map((r) => ({
      ...r,
      routing: assigned.some(
        (s) =>
          s.id !== r.id && r.left < s.right + pitch - epsilon && s.left < r.right + pitch - epsilon,
      )
        ? 'lane'
        : 'preserved',
    })),
    lanes: occupied.length,
    requiredHeight: occupied.length * pitch,
  }
}

// Cut a path at every row boundary, retaining the portions inside each empty gap.
export function splitRowGaps(points, gaps) {
  const cuts = [...new Set(gaps.flatMap((g) => [g.top, g.bottom]))]
  const pieces = []
  for (const [i, b] of points.entries()) {
    if (!i) continue
    const a = points[i - 1],
      dy = b.y - a.y
    const ts = [
      0,
      1,
      ...cuts.flatMap((y) => {
        const t = Math.abs(dy) > epsilon ? (y - a.y) / dy : -1
        return t > epsilon && t < 1 - epsilon ? [t] : []
      }),
    ].sort((x, y) => x - y)
    for (const [j, t] of ts.entries()) {
      if (!j || t - ts[j - 1] < epsilon) continue
      const at = (u) => ({ x: a.x + (b.x - a.x) * u, y: a.y + dy * u })
      const p = at(ts[j - 1]),
        q = at(t),
        mid = (p.y + q.y) / 2
      const gap = gaps.findIndex((g) => mid >= g.top - epsilon && mid <= g.bottom + epsilon)
      const previous = pieces.at(-1)
      if (previous && previous.gap === gap && same(previous.points.at(-1), p))
        previous.points.push(q)
      else pieces.push({ gap, points: [p, q] })
    }
  }
  return pieces
}

export function layoutWireChannels(baseline, { wireClearanceScale = 1 } = {}) {
  if (!Number.isFinite(wireClearanceScale) || wireClearanceScale <= 0)
    throw new Error('Expected positive wire clearance scale')
  const { nodeStroke, frameStroke, wireWidth, clearance, areaRatio } = baseline.avoidance.options
  const pitch = wireWidth + 2 * clearance * wireClearanceScale
  const groupOf = new Map(baseline.groups.flatMap((g, gi) => g.members.map((i) => [i, gi])))
  const root = baseline.nodes.findIndex((n) => n.id === 'test:internet')
  if (root < 0) throw new Error('Missing Internet anchor')
  const bands = baseline.groups.map((_g, gi) =>
    baseline.rows[gi].map((r) => ({
      top: Math.min(...r.members.map((i) => baseline.nodes[i].y - baseline.nodes[i].h / 2)),
      bottom: Math.max(...r.members.map((i) => baseline.nodes[i].y + baseline.nodes[i].h / 2)),
    })),
  )
  const channels = baseline.groups.map((g, gi) => {
    const rs = bands[gi]
    return Array.from({ length: rs.length + 1 }, (_, i) => ({
      gi,
      gap: i,
      top: i ? rs[i - 1].bottom : g.y - g.h / 2,
      bottom: i < rs.length ? rs[i].top : g.y + g.h / 2,
      requests: [],
    }))
  })
  const paths = []
  const addPath = (li, gi, end, points) => {
    const pieces = splitRowGaps(points, channels[gi])
    for (const [pi, p] of pieces.entries()) {
      const a = p.points[0],
        b = p.points.at(-1)
      if (p.gap < 0 || Math.abs(a.x - b.x) < epsilon) continue
      p.request = `${li}:${end}:${pi}`
      channels[gi][p.gap].requests.push({
        id: p.request,
        li,
        end,
        left: Math.min(a.x, b.x),
        right: Math.max(a.x, b.x),
      })
    }
    paths.push({ li, gi, end, pieces })
  }
  for (const [li, l] of baseline.links.entries()) {
    if (!l.crossGroup) addPath(li, l.ga, 'internal', l.points)
    else {
      const start = l.points.findIndex((p) => same(p, l.exit)),
        end = l.points.findIndex((p) => same(p, l.entry))
      if (start < 0 || end <= start) throw new Error('Missing boundary points')
      addPath(li, l.ga, 'a', l.points.slice(0, start + 1))
      addPath(li, l.gb, 'b', l.points.slice(end))
    }
  }
  const allocation = channels.map((gs) =>
    gs.map((g) => {
      if (g.bottom - g.top <= epsilon) throw new Error('Expected separated dependency rows')
      const demand = allocateWireLanes(g.requests, pitch)
      return {
        ...g,
        ...demand,
        oldHeight: g.bottom - g.top,
        height: Math.max(g.bottom - g.top, demand.requiredHeight),
      }
    }),
  )
  // A piecewise-affine Y map: device rows translate rigidly; only empty gaps grow.
  const maps = allocation.map((gs, gi) => {
    const extra = gs.reduce((s, g) => s + g.height - g.oldHeight, 0)
    const map = (y) => {
      let shift = -extra / 2
      for (const g of gs) {
        if (y < g.top) break
        if (y <= g.bottom) return g.top + shift + ((y - g.top) * g.height) / g.oldHeight
        shift += g.height - g.oldHeight
      }
      return y + shift
    }
    const rootShift = baseline.groups[gi].members.includes(root)
      ? baseline.nodes[root].y - map(baseline.nodes[root].y)
      : 0
    return { extra, y: (y) => map(y) + rootShift }
  })
  const seededNodes = baseline.nodes.map((n, i) => ({ ...n, y: maps[groupOf.get(i)].y(n.y) }))
  const seededGroups = baseline.groups.map((g, gi) => ({
    ...g,
    y: (maps[gi].y(g.y - g.h / 2) + maps[gi].y(g.y + g.h / 2)) / 2,
    h: g.h + maps[gi].extra,
  }))
  const seededTerminals = baseline.terminals.map((t) => ({ ...t, y: maps[t.g].y(t.y) }))
  const delta = (ns, gi) => {
    const i = baseline.groups[gi].members[0]
    return { x: ns[i].x - seededNodes[i].x, y: ns[i].y - seededNodes[i].y }
  }
  const point = (p, gi, ns) => {
    const d = delta(ns, gi)
    return { x: p.x + d.x, y: maps[gi].y(p.y) + d.y }
  }
  const terminalsAt = (ns) =>
    seededTerminals.map((t) => {
      const d = delta(ns, t.g)
      return { ...t, x: t.x + d.x, y: t.y + d.y }
    })
  const fitFrames = (_groups, ns) =>
    seededGroups.map((g, gi) => {
      const d = delta(ns, gi),
        x = g.x + d.x,
        y = g.y + d.y
      return { ...g, x, y, radius: Math.hypot(x, y), angleRadians: Math.atan2(y, x) }
    })
  const endpointProvider = (ns) => ({
    terminals: terminalsAt(ns),
    links: baseline.links.map((l) => ({
      ...l,
      points: [point(l.points[0], l.ga, ns), point(l.points.at(-1), l.gb, ns)],
    })),
  })
  const geometry = projectHardHalos(seededNodes, {
    groups: seededGroups,
    links: baseline.links,
    insets: baseline.avoidance.options.insets,
    root,
    nodeStroke,
    frameStroke,
    areaRatio,
    fitFrames,
    endpointProvider,
    rigidInteriors: true,
  })
  if (!geometry) throw new Error('Wire channels cannot satisfy required group bands')
  const ns = geometry.nodes,
    groups = geometry.groups,
    terminals = terminalsAt(ns)
  const routes = routeBoundaryConnections({
    groups,
    nodes: ns,
    positions: ns,
    links: baseline.links,
    terminals,
  })
  const requestMap = new Map()
  const wireChannels = allocation.flatMap((gs, gi) =>
    gs.map((g) => {
      const d = delta(ns, gi),
        top = maps[gi].y(g.top) + d.y,
        bottom = maps[gi].y(g.bottom) + d.y
      const start = top + (g.height - g.requiredHeight) / 2
      const requests = g.requests.map((r) => {
        const value = {
          ...r,
          left: r.left + d.x,
          right: r.right + d.x,
          y: start + (r.lane + 0.5) * pitch,
        }
        requestMap.set(r.id, value)
        return value
      })
      return { ...g, top, bottom, requests }
    }),
  )
  const routedPaths = new Map(
    paths.map((path) => {
      const points = path.pieces.flatMap((p) => {
        const source = p.points.map((v) => point(v, path.gi, ns)),
          request = requestMap.get(p.request)
        if (!request || request.routing === 'preserved') return source
        const a = source[0],
          b = source.at(-1)
        return [a, { x: a.x, y: request.y }, { x: b.x, y: request.y }, b]
      })
      return [`${path.li}:${path.end}`, compact(points)]
    }),
  )
  const links = baseline.links.map((l, li) => {
    if (!l.crossGroup) return { ...l, points: routedPaths.get(`${li}:internal`) }
    const source = routedPaths.get(`${li}:a`),
      target = routedPaths.get(`${li}:b`)
    const exterior = routes[li].points.slice(1, -1)
    return {
      ...l,
      points: compact([...source, ...exterior.slice(1), ...target.slice(1)]),
      exit: source.at(-1),
      entry: target[0],
    }
  })
  const nodes = ns.map((n, i) => {
    const g = groups[groupOf.get(i)]
    return { ...n, localX: n.x - g.x, localY: n.y - g.y }
  })
  const metrics = {
    ...measureLineAvoidance(nodes, links, clearance),
    ...measureWires(links),
    ...measureConnectionHaloSpacing(
      nodes,
      groups,
      links,
      terminals,
      nodeStroke,
      frameStroke,
      areaRatio,
    ),
  }
  if (metrics.hits || metrics.nearPairs || metrics.nodeHaloPairs || metrics.groupHaloPairs)
    throw new Error(`Invalid wire channel layout: ${JSON.stringify(metrics)}`)
  const virtualNodes = baseline.virtualNodes.map((v) => ({ ...v, ...point(v, v.gi, ns) }))
  return {
    nodes,
    groups,
    links,
    terminals,
    virtualNodes,
    wireChannels,
    rows: baseline.rows.map((rs, gi) =>
      rs.map((r) => ({ ...r, y: point({ x: 0, y: r.y }, gi, ns).y })),
    ),
    before: baseline.avoidance.after,
    metrics,
    options: {
      ...baseline.avoidance.options,
      wireChannels: true,
      lanePitch: pitch,
      wireClearanceScale,
    },
    model:
      'Wire-owned row-gap capacity from interval overlap, not total group counts. Reuse lanes for disjoint spans; each active lane occupies wire width plus two clearances. Grow only deficient gaps, keep existing node halo settings and rigid dependency rows. Existing per-link vertical slots already reserve additive width. Map boundary terminals with their frames; translate whole groups to satisfy required halos, then reroute exterior paths. No role tiers or row wrapping.',
    haloProfiles: {
      after: haloProfiles(
        connectionHalos(nodes, groups, links, terminals, nodeStroke, frameStroke, areaRatio),
      ),
    },
    evaluations: 1,
    trace: [],
    moved: nodes.flatMap((n, i) => {
      const dx = n.x - baseline.nodes[i].x,
        dy = n.y - baseline.nodes[i].y
      return Math.hypot(dx, dy) > epsilon
        ? [{ id: n.id, dx, dy, distance: Math.hypot(dx, dy) }]
        : []
    }),
  }
}
