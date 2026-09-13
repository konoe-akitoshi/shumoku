import { segmentHits } from './tmp-test6-v7-boundary-routing.mjs'
import { connectionHalos, measureConnectionHaloSpacing } from './tmp-test6-v8-connection-halo.mjs'
import { measureWires } from './tmp-test6-v8-dynamic-avoidance.mjs'
import { measureLineAvoidance } from './tmp-test6-v8-line-avoidance.mjs'

export const sides = ['left', 'right', 'top', 'bottom']
const eps = 1e-6
const seq = (n) => Array.from({ length: n }, (_, i) => i)
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
export const rectangle = (n, padding = 0) => ({
  left: n.x - n.w / 2 - padding,
  right: n.x + n.w / 2 + padding,
  top: n.y - n.h / 2 - padding,
  bottom: n.y + n.h / 2 + padding,
})
const horizontal = (side) => side === 'top' || side === 'bottom'
const clamp = (x, a, b) => Math.max(a, Math.min(b, x))
export function edgePoint(box, side, offset = 0) {
  return horizontal(side)
    ? { x: box.x + offset, y: box.y + ((side === 'top' ? -1 : 1) * box.h) / 2 }
    : { x: box.x + ((side === 'left' ? -1 : 1) * box.w) / 2, y: box.y + offset }
}
const tangent = (p, side) => (horizontal(side) ? p.x : p.y)
const centerTangent = (box, side) => (horizontal(side) ? box.x : box.y)
const edgeLength = (box, side) => (horizontal(side) ? box.w : box.h)
const orderKey = (request, side, orders) => orders[request.key] ?? tangent(request.toward, side)

// Side choices are rebuilt from current geometry, unless this search candidate
// explicitly proposes another side. Capacity is physical edge length, not a tier.
export function assignSides(box, requests, pitch, choices, orders, bounded) {
  const buckets = Object.fromEntries(sides.map((side) => [side, []]))
  const sorted = [...requests].sort(
    (a, b) =>
      Number(Boolean(choices[b.key])) - Number(Boolean(choices[a.key])) ||
      a.key.localeCompare(b.key),
  )
  for (const r of sorted) {
    const candidates = choices[r.key]
      ? [choices[r.key]]
      : [...sides].sort((a, b) => {
          const cost = (s) => distance(edgePoint(box, s), r.toward)
          return cost(a) - cost(b)
        })
    const side = candidates.find(
      (s) => !bounded || (buckets[s].length + 2) * pitch <= edgeLength(box, s) + eps,
    )
    if (!side) return null
    buckets[side].push({ ...r, side })
  }
  return sides.flatMap((side) =>
    buckets[side]
      .sort(
        (a, b) =>
          orderKey(a, side, orders) - orderKey(b, side, orders) || a.key.localeCompare(b.key),
      )
      .map((r, rank, a) => ({ ...r, rank, count: a.length })),
  )
}

// Exact 1D least-squares projection onto ordered, pitch-separated boundary slots.
// Order is a candidate decision, not a constraint inherited from the old diagram.
export function placeBoundarySlots(box, requests, pitch, offsets = {}) {
  const result = []
  for (const side of sides) {
    const rs = requests.filter((r) => r.side === side),
      blocks = []
    const half = edgeLength(box, side) / 2,
      center = centerTangent(box, side)
    for (const [i, r] of rs.entries()) {
      const value = tangent(r.toward, side) - center - i * pitch + (offsets[r.key] ?? 0)
      blocks.push({ sum: value, count: 1 })
      while (
        blocks.length > 1 &&
        blocks.at(-2).sum / blocks.at(-2).count > blocks.at(-1).sum / blocks.at(-1).count
      ) {
        const b = blocks.pop(),
          a = blocks.pop()
        blocks.push({ sum: a.sum + b.sum, count: a.count + b.count })
      }
    }
    const values = blocks.flatMap((b) =>
      Array(b.count).fill(
        clamp(b.sum / b.count, -half + pitch, half - pitch - (rs.length - 1) * pitch),
      ),
    )
    for (const [i, r] of rs.entries())
      result.push({ ...r, ...edgePoint(box, side, values[i] + i * pitch) })
  }
  return result
}

export function createCoupledModel(input, display, options) {
  if (!options.rootId || !options.anchor) throw new Error('Explicit rootId and anchor required')
  const nodes = [...input.nodes]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((n) => {
      const d = display.nodes.find((v) => v.id === n.id)
      if (!d) throw new Error(`Missing displayed dimensions: ${n.id}`)
      return { id: n.id, label: n.label, parent: n.parent, role: d.role, w: d.w, h: d.h }
    })
  const index = new Map(nodes.map((n, i) => [n.id, i]))
  const groups = [...input.subgraphs]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((g) => ({
      id: g.id,
      label: g.label,
      members: nodes.flatMap((n, i) => (n.parent === g.id ? [i] : [])),
    }))
    .filter((g) => g.members.length)
  const groupOf = nodes.map((n) => groups.findIndex((g) => g.id === n.parent))
  if (groupOf.some((g) => g < 0)) throw new Error('All nodes must belong to a displayed group')
  const links = input.links.map((l) => {
    const a = index.get(l.from.node),
      b = index.get(l.to.node)
    if (a === undefined || b === undefined) throw new Error('Unknown link endpoint')
    return {
      id: l.id,
      a,
      b,
      ga: groupOf[a],
      gb: groupOf[b],
      crossGroup: groupOf[a] !== groupOf[b],
      role: l.metadata?.topologyRole,
    }
  })
  const root = index.get(options.rootId)
  if (root === undefined) throw new Error('Unknown root')
  const neighbors = nodes.map(() => new Set())
  for (const l of links) {
    neighbors[l.a].add(l.b)
    neighbors[l.b].add(l.a)
  }
  const depths = nodes.map(() => Infinity),
    queue = [root]
  depths[root] = 0
  for (const i of queue)
    for (const j of neighbors[i])
      if (!Number.isFinite(depths[j])) {
        depths[j] = depths[i] + 1
        queue.push(j)
      }
  const scale = Math.sqrt(nodes.reduce((s, n) => s + n.w * n.h, 0) / nodes.length)
  return {
    nodes,
    groups,
    links,
    groupOf,
    root,
    depths,
    neighbors,
    scale,
    options: {
      ...options,
      pitch: options.wireWidth + 2 * options.clearance * options.wireClearanceScale,
    },
  }
}

export function blankState(positions) {
  return {
    positions: positions.map((p) => ({ x: p.x, y: p.y })),
    nodeSides: {},
    boundarySides: {},
    nodeOrders: {},
    boundaryOrders: {},
    routeFocus: {},
  }
}

function fittedFrames(model, nodes, halos, requests = []) {
  return model.groups.map((g, gi) => {
    const p = model.options.insets,
      content = g.members.map((i) => {
        const n = nodes[i],
          h = halos?.nodes[i]
        if (!h) return n
        return {
          ...h,
          x: n.x + (h.sides.right - h.sides.left) / 2,
          y: n.y + (h.sides.bottom - h.sides.top) / 2,
        }
      })
    const left = Math.min(...content.map((n) => n.x - n.w / 2)) - p.left,
      right = Math.max(...content.map((n) => n.x + n.w / 2)) + p.right
    const top = Math.min(...content.map((n) => n.y - n.h / 2)) - p.top,
      bottom = Math.max(...content.map((n) => n.y + n.h / 2)) + p.bottom
    const capacity = (side) =>
      (requests.filter((t) => t.g === gi && t.side === side).length + 1) * model.options.pitch
    return {
      ...g,
      x: (left + right) / 2,
      y: (top + bottom) / 2,
      w: Math.max(right - left, capacity('top'), capacity('bottom')),
      h: Math.max(bottom - top, capacity('left'), capacity('right')),
    }
  })
}

function endpoints(model, nodes, groups, state) {
  const { pitch } = model.options
  let terminals = []
  for (const [gi, g] of groups.entries()) {
    const rs = model.links.flatMap((l, li) =>
      !l.crossGroup
        ? []
        : ['a', 'b'].flatMap((end) =>
            l[end === 'a' ? 'ga' : 'gb'] === gi
              ? [
                  {
                    key: `${li}:${end}`,
                    li,
                    end,
                    g: gi,
                    node: l[end],
                    toward: nodes[l[end === 'a' ? 'b' : 'a']],
                  },
                ]
              : [],
          ),
    )
    terminals.push(...assignSides(g, rs, pitch, state.boundarySides, state.boundaryOrders, false))
  }
  terminals = groups.flatMap((g, gi) =>
    placeBoundarySlots(
      g,
      terminals.filter((t) => t.g === gi),
      pitch,
      state.boundaryOffsets,
    ),
  )
  const terminalMap = new Map(terminals.map((t) => [t.key, t])),
    ports = []
  for (const [i, n] of nodes.entries()) {
    const rs = model.links.flatMap((l, li) =>
      ['a', 'b'].flatMap((end) =>
        l[end] === i
          ? [
              {
                key: `${li}:${end}`,
                li,
                end,
                node: i,
                toward: l.crossGroup
                  ? terminalMap.get(`${li}:${end}`)
                  : nodes[l[end === 'a' ? 'b' : 'a']],
              },
            ]
          : [],
      ),
    )
    const assignments = assignSides(n, rs, pitch, state.nodeSides, state.nodeOrders, true)
    if (!assignments) return null
    ports.push(
      ...assignments.map((p) => ({
        ...p,
        pitch,
        offset: (p.rank - (p.count - 1) / 2) * pitch,
        ...edgePoint(n, p.side, (p.rank - (p.count - 1) / 2) * pitch),
      })),
    )
  }
  const lookup = new Map(ports.map((p) => [p.key, p]))
  const links = model.links.map((l, li) => ({
    ...l,
    points: [lookup.get(`${li}:a`), lookup.get(`${li}:b`)],
  }))
  return { terminals, ports, links }
}

// No retained separation axes, old signs, roles or depth ordering. The least
// translation is chosen anew from the current rectangles. Search can swap or
// jump across any object; projection is a feasibility repair, not the search.
export function overlapCorrection(a, b) {
  const A = rectangle(a),
    B = rectangle(b)
  if (
    Math.min(A.right, B.right) - Math.max(A.left, B.left) <= eps ||
    Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top) <= eps
  )
    return null
  return [
    { x: B.left - A.right, y: 0 },
    { x: B.right - A.left, y: 0 },
    { x: 0, y: B.top - A.bottom },
    { x: 0, y: B.bottom - A.top },
  ].sort((u, v) => Math.hypot(u.x, u.y) - Math.hypot(v.x, v.y))[0]
}

function settle(model, state) {
  let nodes = model.nodes.map((n, i) => ({ ...n, ...state.positions[i] })),
    halos = null,
    oldSignature = ''
  const o = model.options
  let maxCorrection = 0
  const shift = (members, dx, dy) => {
    for (const i of members) {
      nodes[i].x += dx
      nodes[i].y += dy
    }
  }
  const separate = (a, b, ma, mb) => {
    const d = overlapCorrection(a, b)
    if (!d) return false
    maxCorrection = Math.max(maxCorrection, Math.hypot(d.x, d.y))
    const fa = ma.includes(model.root) ? 0 : mb.includes(model.root) ? 1 : 0.5
    shift(ma, d.x * fa, d.y * fa)
    shift(mb, -d.x * (1 - fa), -d.y * (1 - fa))
    a.x += d.x * fa
    a.y += d.y * fa
    b.x -= d.x * (1 - fa)
    b.y -= d.y * (1 - fa)
    return true
  }
  for (const _pass of seq(o.maxRepairPasses)) {
    maxCorrection = 0
    let groups = fittedFrames(model, nodes, halos),
      ep = endpoints(model, nodes, groups, state)
    if (!ep) return null
    groups = fittedFrames(model, nodes, halos, ep.terminals)
    ep = endpoints(model, nodes, groups, state)
    if (!ep) return null
    halos = connectionHalos(
      nodes,
      groups,
      ep.links,
      ep.terminals,
      o.nodeStroke,
      o.frameStroke,
      o.areaRatio,
    )
    let changed = false
    for (const g of model.groups)
      for (const [k, i] of g.members.entries())
        for (const j of g.members.slice(k + 1))
          changed = separate(halos.nodes[i], halos.nodes[j], [i], [j]) || changed
    if (changed) {
      o.diagnostic?.({ pass: _pass, stage: 'nodes' })
      continue
    }
    for (const [i, a] of groups.entries())
      for (const [offset, b] of groups.slice(i + 1).entries())
        changed =
          separate(halos.groups[i], halos.groups[i + offset + 1], a.members, b.members) || changed
    const dx = o.anchor.x - nodes[model.root].x,
      dy = o.anchor.y - nodes[model.root].y
    if (dx || dy) shift(seq(nodes.length), dx, dy)
    if (changed) {
      o.diagnostic?.({ pass: _pass, stage: 'groups', maxCorrection })
      continue
    }
    const signature = JSON.stringify([
      groups.map((g) => [g.x, g.y, g.w, g.h]),
      ep.ports.map((p) => p.side),
      ep.terminals.map((t) => t.side),
    ])
    if (signature === oldSignature) return { nodes, groups, ...ep }
    o.diagnostic?.({ pass: _pass, stage: 'settling' })
    oldSignature = signature
  }
  return null
}

const orient = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
function segmentCost(a, b, other, scale, weights) {
  let value = distance(a, b)
  for (const l of other)
    for (const [i, d] of l.points.entries())
      if (i) {
        const c = l.points[i - 1]
        if (orient(a, b, c) * orient(a, b, d) < -eps && orient(c, d, a) * orient(c, d, b) < -eps)
          value += weights.crossings * scale
        if (Math.abs(orient(a, b, c)) < eps && Math.abs(orient(a, b, d)) < eps) {
          const len = distance(a, b)
          if (len < eps) continue
          const project = (p) => ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / len
          const pc = project(c),
            pd = project(d)
          value +=
            weights.overlap *
            Math.max(0, Math.min(len, Math.max(pc, pd)) - Math.max(0, Math.min(pc, pd)))
        }
      }
  return value
}

export function visibilityPath(
  a,
  b,
  obstacles,
  frame = null,
  other = [],
  scale = 1,
  weights = { crossings: 1, overlap: 1 },
) {
  const visible = (u, v) => !obstacles.some((o) => segmentHits(u, v, o))
  if (!other.length && visible(a, b)) return [a, b]
  const inside = (p) =>
    !frame ||
    (p.x >= frame.left - eps &&
      p.x <= frame.right + eps &&
      p.y >= frame.top - eps &&
      p.y <= frame.bottom + eps)
  const vertices = [
    a,
    b,
    ...obstacles
      .flatMap((r) => [
        { x: r.left, y: r.top },
        { x: r.right, y: r.top },
        { x: r.right, y: r.bottom },
        { x: r.left, y: r.bottom },
      ])
      .filter(
        (p) =>
          inside(p) &&
          !obstacles.some(
            (o) =>
              p.x > o.left + eps &&
              p.x < o.right - eps &&
              p.y > o.top + eps &&
              p.y < o.bottom - eps,
          ),
      ),
  ]
  const distances = vertices.map(() => Infinity),
    previous = vertices.map(() => -1),
    seen = new Set()
  distances[0] = 0
  for (const _step of vertices) {
    let current = -1
    for (const [i] of vertices.entries())
      if (!seen.has(i) && (current < 0 || distances[i] < distances[current])) current = i
    if (current < 0 || !Number.isFinite(distances[current])) return null
    if (current === 1) {
      const points = []
      let i = 1
      while (i >= 0) {
        points.push(vertices[i])
        i = previous[i]
      }
      return points.reverse()
    }
    seen.add(current)
    for (const [j, v] of vertices.entries())
      if (!seen.has(j) && visible(vertices[current], v)) {
        const d = distances[current] + segmentCost(vertices[current], v, other, scale, weights)
        if (d < distances[j]) {
          distances[j] = d
          previous[j] = current
        }
      }
  }
  return null
}

function routeAll(model, geometry, state) {
  const { nodes, groups, terminals, ports } = geometry,
    o = model.options
  const termMap = new Map(terminals.map((t) => [t.key, t])),
    portMap = new Map(ports.map((p) => [p.key, p]))
  const route = (l, li, other) => {
    const a = portMap.get(`${li}:a`),
      b = portMap.get(`${li}:b`)
    const interior = (start, end, gi) =>
      visibilityPath(
        start,
        end,
        groups[gi].members.map((i) =>
          rectangle(nodes[i], i === l.a || i === l.b ? 0 : o.clearance),
        ),
        rectangle(groups[gi]),
        other,
        model.scale,
        o.weights,
      )
    if (!l.crossGroup) {
      const points = interior(a, b, l.ga)
      return points ? { ...l, points } : null
    }
    const exit = termMap.get(`${li}:a`),
      entry = termMap.get(`${li}:b`)
    const first = interior(a, exit, l.ga),
      last = interior(entry, b, l.gb)
    const exterior = visibilityPath(
      exit,
      entry,
      groups.map((g) => rectangle(g)),
      null,
      other,
      model.scale,
      o.weights,
    )
    return first && last && exterior
      ? { ...l, points: [...first, ...exterior.slice(1), ...last.slice(1)], exit, entry }
      : null
  }
  const links = model.links.map((l, li) => route(l, li, []))
  if (links.some((l) => !l)) return null
  for (const li of state.routeOrder ?? links.map((_l, i) => i))
    if (state.routeFocus[li]) {
      const next = route(
        links[li],
        li,
        links.filter((_l, i) => i !== li),
      )
      if (next) links[li] = next
    }
  return links
}

export function scoreGeometry(model, nodes, links, metrics) {
  let dependency = 0
  for (const l of links) {
    if (
      !Number.isFinite(model.depths[l.a]) ||
      !Number.isFinite(model.depths[l.b]) ||
      model.depths[l.a] === model.depths[l.b]
    )
      continue
    const p = model.depths[l.a] < model.depths[l.b] ? nodes[l.a] : nodes[l.b],
      c = p === nodes[l.a] ? nodes[l.b] : nodes[l.a]
    const desired = (p.h + c.h) / 2 + model.options.pitch
    dependency += (Math.max(0, desired - (c.y - p.y)) / desired) ** 2
  }
  const terms = {
    length: metrics.length / model.scale,
    crossings: metrics.crossings,
    overlap: metrics.overlapLength / model.scale,
    dependency,
  }
  return {
    terms,
    score: Object.entries(terms).reduce((s, [k, v]) => s + model.options.weights[k] * v, 0),
  }
}

export function evaluateCoupled(model, state) {
  const geometry = settle(model, state)
  if (!geometry) {
    model.options.diagnostic?.({ stage: 'geometry-failed' })
    return null
  }
  const links = routeAll(model, geometry, state)
  if (!links) {
    model.options.diagnostic?.({ stage: 'routing-failed' })
    return null
  }
  const { nodes, groups, terminals, ports } = geometry,
    o = model.options
  const metrics = {
    ...measureLineAvoidance(nodes, links, o.clearance),
    ...measureWires(links),
    ...measureConnectionHaloSpacing(
      nodes,
      groups,
      links,
      terminals,
      o.nodeStroke,
      o.frameStroke,
      o.areaRatio,
    ),
  }
  if (metrics.hits || metrics.nearPairs || metrics.nodeHaloPairs || metrics.groupHaloPairs) {
    o.diagnostic?.({ stage: 'metrics-failed', metrics })
    return null
  }
  return {
    nodes,
    groups,
    links,
    terminals,
    nodePorts: ports,
    metrics,
    ...scoreGeometry(model, nodes, links, metrics),
    state: { ...state, positions: nodes.map((n) => ({ x: n.x, y: n.y })) },
  }
}
