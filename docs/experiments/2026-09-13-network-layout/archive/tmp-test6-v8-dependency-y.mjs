import { routeBoundaryConnections } from './tmp-test6-v7-boundary-routing.mjs'
import {
  connectionHalos,
  haloProfiles,
  measureConnectionHaloSpacing,
} from './tmp-test6-v8-connection-halo.mjs'
import { measureWires } from './tmp-test6-v8-dynamic-avoidance.mjs'
import { projectHardHalos } from './tmp-test6-v8-hard-halo.mjs'
import { measureLineAvoidance } from './tmp-test6-v8-line-avoidance.mjs'
import { interiorPath } from './tmp-test6-v8-virtual-rows.mjs'

const seq = (n) => Array.from({ length: n }, (_, i) => i)
const epsilon = 1e-6
const difference = (x, e) => (e.j < 0 ? 0 : x[e.j]) - (e.i < 0 ? 0 : x[e.i])
export const springEnergy = (x, terms) =>
  terms.reduce((s, e) => s + e.weight * (difference(x, e) - e.target) ** 2, 0)

// Convex quadratic springs with linear difference constraints. ADMM splits
// spring fitting from interval feasibility. No term references an initial Y.
export function solveDependencyY(
  initial,
  terms,
  constraints,
  { maxIterations = 20000, tolerance = 1e-7 } = {},
) {
  const n = initial.length,
    indices = seq(n)
  const rho = terms.length ? terms.reduce((s, e) => s + e.weight, 0) / terms.length : 1
  const matrix = indices.map(() => new Float64Array(n)),
    linear = new Float64Array(n)
  const coefficients = (e) =>
    [
      [e.i, -1],
      [e.j, 1],
    ].filter(([i]) => i >= 0)
  for (const e of terms)
    for (const [i, ci] of coefficients(e)) {
      linear[i] += e.weight * e.target * ci
      for (const [j, cj] of coefficients(e)) matrix[i][j] += e.weight * ci * cj
    }
  for (const c of constraints)
    for (const [i, ci] of coefficients(c))
      for (const [j, cj] of coefficients(c)) matrix[i][j] += rho * ci * cj
  const lower = indices.map(() => new Float64Array(n))
  for (const i of indices)
    for (const j of indices.slice(0, i + 1)) {
      let value = matrix[i][j]
      for (const k of indices.slice(0, j)) value -= lower[i][k] * lower[j][k]
      if (i === j && value <= 0) throw new Error('Unanchored dependency component')
      lower[i][j] = i === j ? Math.sqrt(value) : value / lower[j][j]
    }
  const solve = (rhs) => {
    const y = new Float64Array(n),
      x = new Float64Array(n)
    for (const i of indices) {
      let v = rhs[i]
      for (const j of indices.slice(0, i)) v -= lower[i][j] * y[j]
      y[i] = v / lower[i][i]
    }
    for (const i of [...indices].reverse()) {
      let v = y[i]
      for (const j of indices.slice(i + 1)) v -= lower[j][i] * x[j]
      x[i] = v / lower[i][i]
    }
    return [...x]
  }
  const clamp = (v, c) => Math.max(c.min ?? -Infinity, Math.min(c.max ?? Infinity, v))
  let x = [...initial],
    z = constraints.map((c) => clamp(difference(x, c), c))
  const u = constraints.map(() => 0)
  let iteration = 0,
    residual = Infinity,
    change = Infinity
  for (const step of seq(maxIterations)) {
    const rhs = Float64Array.from(linear)
    for (const [k, c] of constraints.entries())
      for (const [i, ci] of coefficients(c)) rhs[i] += rho * ci * (z[k] - u[k])
    const next = solve(rhs)
    change = Math.max(...next.map((v, i) => Math.abs(v - x[i])))
    x = next
    const previous = z
    z = constraints.map((c, k) => clamp(difference(x, c) + u[k], c))
    residual = 0
    for (const [k, c] of constraints.entries()) {
      const r = difference(x, c) - z[k]
      u[k] += r
      residual = Math.max(residual, Math.abs(r), Math.abs(z[k] - previous[k]))
    }
    iteration = step + 1
    if (residual < tolerance && change < tolerance) break
  }
  if (residual >= tolerance || change >= tolerance)
    throw new Error(`Dependency solver did not converge: residual=${residual}, change=${change}`)
  return {
    values: x,
    iterations: iteration,
    residual,
    change,
    converged: residual < tolerance && change < tolerance,
    before: springEnergy(initial, terms),
    after: springEnergy(x, terms),
  }
}

const same = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < epsilon
const overlapX = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > epsilon
const rectX = (n) => ({ left: n.x - n.w / 2, right: n.x + n.w / 2 })

export function layoutDependencyY(baseline) {
  const {
    nodeStroke,
    frameStroke,
    areaRatio,
    clearance,
    lanePitch: pitch,
    insets,
  } = baseline.avoidance.options
  const root = baseline.nodes.findIndex((n) => n.id === 'test:internet')
  if (root < 0) throw new Error('Missing Internet anchor')
  const groupOf = new Map(baseline.groups.flatMap((g, gi) => g.members.map((i) => [i, gi])))
  const halos = connectionHalos(
    baseline.nodes,
    baseline.groups,
    baseline.links,
    baseline.terminals,
    nodeStroke,
    frameStroke,
    areaRatio,
  )
  const tracks = baseline.wireChannels.flatMap((c) =>
    c.requests
      .filter((r) => r.routing === 'lane')
      .map((r) => ({ ...r, gi: c.gi, kind: 'wire-lane' })),
  )
  const pathPlans = []
  const addPlan = (li, gi, startNode, endNode, points, boundary = null) => {
    const visits = tracks
      .filter((t) => t.li === li && t.gi === gi)
      .flatMap((t) => {
        const index = points.findIndex(
          (p, i) =>
            i &&
            Math.abs(p.y - t.y) < epsilon &&
            Math.abs(points[i - 1].y - t.y) < epsilon &&
            Math.min(p.x, points[i - 1].x) <= t.left + epsilon &&
            Math.max(p.x, points[i - 1].x) >= t.right - epsilon,
        )
        return index < 0
          ? []
          : [{ id: t.id, index, forward: points[index].x > points[index - 1].x }]
      })
      .sort((a, b) => a.index - b.index)
    pathPlans.push({ li, gi, startNode, endNode, boundary, visits })
  }
  for (const [li, l] of baseline.links.entries()) {
    if (!l.crossGroup) addPlan(li, l.ga, l.a, l.b, l.points)
    else {
      const a = l.points.findIndex((p) => same(p, l.exit)),
        b = l.points.findIndex((p) => same(p, l.entry))
      addPlan(
        li,
        l.ga,
        l.a,
        null,
        l.points.slice(0, a + 1),
        baseline.terminals.find((t) => t.li === li && t.end === 'a'),
      )
      addPlan(
        li,
        l.gb,
        l.b,
        null,
        l.points.slice(b).reverse(),
        baseline.terminals.find((t) => t.li === li && t.end === 'b'),
      )
    }
  }
  const solvedNodes = baseline.nodes.map((n) => ({ ...n })),
    solvedTracks = tracks.map((t) => ({ ...t }))
  const reports = []
  for (const [gi, group] of baseline.groups.entries()) {
    const localTracks = tracks.filter((t) => t.gi === gi)
    const nodeIndex = new Map(group.members.map((i, k) => [i, k]))
    const trackIndex = new Map(localTracks.map((t, k) => [t.id, group.members.length + k]))
    const initial = [
      ...group.members.map((i) => baseline.nodes[i].y - group.y),
      ...localTracks.map((t) => t.y - group.y),
    ]
    const terms = [],
      constraints = [],
      dependencies = []
    const addSpring = (i, j, target, scale, kind) =>
      terms.push({ i, j, target, weight: 1 / scale ** 2, kind })
    for (const l of baseline.links)
      if (l.ga === gi && l.gb === gi) {
        const a = baseline.nodes[l.a],
          b = baseline.nodes[l.b]
        if (a.rootDistance === b.rootDistance) continue
        const parent = a.rootDistance < b.rootDistance ? l.a : l.b,
          child = parent === l.a ? l.b : l.a
        const p = baseline.nodes[parent],
          c = baseline.nodes[child]
        const distance =
          p.h / 2 +
          c.h / 2 +
          nodeStroke +
          halos.nodes[parent].sides.bottom +
          halos.nodes[child].sides.top +
          pitch
        addSpring(nodeIndex.get(parent), nodeIndex.get(child), distance, distance, 'dependency')
        dependencies.push({ parent, child, distance })
      }
    const port = (li, node) => {
      const l = baseline.links[li],
        p = node === l.a ? l.points[0] : l.points.at(-1)
      return { index: nodeIndex.get(node), x: p.x, offset: p.y - baseline.nodes[node].y }
    }
    for (const plan of pathPlans.filter((p) => p.gi === gi)) {
      const symbols = [port(plan.li, plan.startNode)]
      for (const visit of plan.visits) {
        const t = localTracks.find((t) => t.id === visit.id)
        symbols.push({
          index: trackIndex.get(t.id),
          x: visit.forward ? t.left : t.right,
          offset: 0,
        })
        symbols.push({
          index: trackIndex.get(t.id),
          x: visit.forward ? t.right : t.left,
          offset: 0,
        })
      }
      symbols.push(
        plan.endNode !== null
          ? port(plan.li, plan.endNode)
          : { index: -1, x: plan.boundary.x, offset: plan.boundary.y - group.y },
      )
      for (const [k, s] of symbols.entries())
        if (k) {
          const a = symbols[k - 1]
          if (a.index === s.index) continue
          const scale = Math.hypot(s.x - a.x, baseline.nodes[plan.startNode].h + pitch)
          addSpring(a.index, s.index, a.offset - s.offset, scale, 'wire')
        }
    }
    for (const [k, i] of group.members.entries())
      for (const j of group.members.slice(k + 1)) {
        if (!overlapX(rectX(halos.nodes[i]), rectX(halos.nodes[j]))) continue
        const a = baseline.nodes[i].y < baseline.nodes[j].y ? i : j,
          b = a === i ? j : i
        const gap =
          baseline.nodes[a].h / 2 +
          baseline.nodes[b].h / 2 +
          nodeStroke +
          halos.nodes[a].sides.bottom +
          halos.nodes[b].sides.top
        constraints.push({ i: nodeIndex.get(a), j: nodeIndex.get(b), min: gap, kind: 'node-band' })
      }
    for (const t of localTracks) {
      const ti = trackIndex.get(t.id),
        extent = { left: t.left - pitch / 2, right: t.right + pitch / 2 }
      for (const i of group.members) {
        const n = baseline.nodes[i]
        if (!overlapX(extent, rectX(n))) continue
        const above = t.y < n.y
        constraints.push({
          i: above ? ti : nodeIndex.get(i),
          j: above ? nodeIndex.get(i) : ti,
          min: n.h / 2 + pitch / 2,
          kind: 'wire-node',
        })
      }
    }
    for (const [k, a] of localTracks.entries())
      for (const b of localTracks.slice(k + 1)) {
        if (
          !overlapX(
            { left: a.left - pitch / 2, right: a.right + pitch / 2 },
            { left: b.left - pitch / 2, right: b.right + pitch / 2 },
          )
        )
          continue
        const above = a.y < b.y
        constraints.push({
          i: trackIndex.get(above ? a.id : b.id),
          j: trackIndex.get(above ? b.id : a.id),
          min: pitch,
          kind: 'wire-wire',
        })
      }
    if (nodeIndex.has(root))
      constraints.push({
        i: -1,
        j: nodeIndex.get(root),
        min: initial[nodeIndex.get(root)],
        max: initial[nodeIndex.get(root)],
        kind: 'internet-anchor',
      })
    // A free connected component needs only a translation gauge, not a row target.
    const adjacency = initial.map(() => new Set()),
      grounded = new Set()
    for (const e of [...terms, ...constraints]) {
      if (e.i < 0) grounded.add(e.j)
      else if (e.j < 0) grounded.add(e.i)
      else {
        adjacency[e.i].add(e.j)
        adjacency[e.j].add(e.i)
      }
    }
    const seen = new Set()
    for (const start of seq(initial.length))
      if (!seen.has(start)) {
        const component = [start]
        seen.add(start)
        for (const i of component)
          for (const j of adjacency[i])
            if (!seen.has(j)) {
              seen.add(j)
              component.push(j)
            }
        if (!component.some((i) => grounded.has(i)))
          constraints.push({
            i: -1,
            j: start,
            min: initial[start],
            max: initial[start],
            kind: 'translation-gauge',
          })
      }
    const solution = solveDependencyY(initial, terms, constraints)
    for (const i of group.members) solvedNodes[i].y = group.y + solution.values[nodeIndex.get(i)]
    for (const t of localTracks)
      solvedTracks.find((s) => s.id === t.id).y = group.y + solution.values[trackIndex.get(t.id)]
    reports.push({
      group: group.id,
      variables: initial.length,
      terms,
      constraints,
      dependencies,
      initial,
      ...solution,
    })
  }
  // Remove solver tolerance at the user anchor by translating its entire group.
  // Relative node/track distances (and therefore its local solution) are unchanged.
  const anchorDelta = baseline.nodes[root].y - solvedNodes[root].y
  for (const i of baseline.groups[groupOf.get(root)].members) solvedNodes[i].y += anchorDelta
  for (const t of solvedTracks) if (t.gi === groupOf.get(root)) t.y += anchorDelta
  const delta = (nodes, gi) => {
    const i = baseline.groups[gi].members[0]
    return { x: nodes[i].x - solvedNodes[i].x, y: nodes[i].y - solvedNodes[i].y }
  }
  const tracksAt = (nodes) =>
    solvedTracks.map((t) => {
      const d = delta(nodes, t.gi)
      return { ...t, left: t.left + d.x, right: t.right + d.x, y: t.y + d.y }
    })
  const fit = (_groups, nodes) =>
    baseline.groups.map((g, gi) => {
      const ts = tracksAt(nodes).filter((t) => t.gi === gi),
        p = insets[gi]
      const left =
        Math.min(
          ...g.members.map((i) => nodes[i].x - nodes[i].w / 2),
          ...ts.map((t) => t.left - pitch / 2),
        ) - p.left
      const right =
        Math.max(
          ...g.members.map((i) => nodes[i].x + nodes[i].w / 2),
          ...ts.map((t) => t.right + pitch / 2),
        ) + p.right
      const top =
        Math.min(
          ...g.members.map((i) => nodes[i].y - nodes[i].h / 2),
          ...ts.map((t) => t.y - pitch / 2),
        ) - p.top
      const bottom =
        Math.max(
          ...g.members.map((i) => nodes[i].y + nodes[i].h / 2),
          ...ts.map((t) => t.y + pitch / 2),
        ) + p.bottom
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
  const terminalsAt = (groups) =>
    baseline.terminals.map((t) => {
      const old = baseline.groups[t.g],
        g = groups[t.g]
      return {
        ...t,
        x: g.x + ((t.x - old.x) * g.w) / old.w,
        y: g.y + ((t.y - old.y) * g.h) / old.h,
      }
    })
  const nodePoint = (node, end, l, nodes) => {
    const p = end === 'a' ? l.points[0] : l.points.at(-1)
    return {
      x: p.x + nodes[node].x - baseline.nodes[node].x,
      y: p.y + nodes[node].y - baseline.nodes[node].y,
    }
  }
  const endpoints = (nodes, groups) => ({
    terminals: terminalsAt(groups),
    links: baseline.links.map((l) => ({
      ...l,
      points: [nodePoint(l.a, 'a', l, nodes), nodePoint(l.b, 'b', l, nodes)],
    })),
  })
  const geometry = projectHardHalos(solvedNodes, {
    groups: baseline.groups,
    links: baseline.links,
    insets,
    root,
    nodeStroke,
    frameStroke,
    areaRatio,
    fitFrames: fit,
    endpointProvider: endpoints,
    rigidInteriors: true,
    enforceDepthOrder: false,
  })
  if (!geometry) throw new Error('Could not separate frames after dependency optimization')
  const nodes = geometry.nodes.map((n, i) => {
    const g = geometry.groups[groupOf.get(i)]
    return { ...n, localX: n.x - g.x, localY: n.y - g.y }
  })
  const groups = geometry.groups,
    terminals = terminalsAt(groups),
    finalTracks = tracksAt(nodes)
  const routed = routeBoundaryConnections({
    groups,
    nodes,
    positions: nodes,
    links: baseline.links,
    terminals,
  })
  const interiorPlans = new Map()
  for (const plan of pathPlans) {
    const l = baseline.links[plan.li],
      side = plan.startNode === l.a ? 'a' : 'b'
    const targets = [nodePoint(plan.startNode, side, l, nodes)]
    for (const visit of plan.visits) {
      const t = finalTracks.find((t) => t.id === visit.id)
      targets.push(
        { x: visit.forward ? t.left : t.right, y: t.y },
        { x: visit.forward ? t.right : t.left, y: t.y },
      )
    }
    const terminal =
      plan.endNode === null ? terminals.find((t) => t.li === plan.li && t.end === side) : null
    targets.push(
      terminal ? { x: terminal.x, y: terminal.y } : nodePoint(plan.endNode, 'b', l, nodes),
    )
    const points = [targets[0]],
      owners = new Set([nodes[l.a].id, nodes[l.b].id])
    for (const [i, p] of targets.entries())
      if (i)
        points.push(
          ...interiorPath(
            targets[i - 1],
            p,
            groups[plan.gi].members.map((j) => nodes[j]),
            groups[plan.gi],
            owners,
            clearance,
          ).slice(1),
        )
    interiorPlans.set(
      `${plan.li}:${side}`,
      points.filter((p, i) => !i || !same(p, points[i - 1])),
    )
  }
  const links = baseline.links.map((l, li) => {
    const a = interiorPlans.get(`${li}:a`)
    if (!l.crossGroup)
      return {
        ...l,
        points: a,
        virtualIds: finalTracks.filter((t) => t.li === li).map((t) => t.id),
      }
    const b = [...interiorPlans.get(`${li}:b`)].reverse(),
      outside = routed[li].points.slice(1, -1)
    return {
      ...l,
      points: [...a, ...outside.slice(1), ...b.slice(1)],
      exit: a.at(-1),
      entry: b[0],
      virtualIds: finalTracks.filter((t) => t.li === li).map((t) => t.id),
    }
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
    throw new Error(`Invalid dependency geometry: ${JSON.stringify(metrics)}`)
  const rowAudit = baseline.rows.flatMap((rs, gi) =>
    rs.map((r) => {
      const ys = r.members.map((i) => nodes[i].y),
        mean = ys.reduce((a, b) => a + b, 0) / ys.length
      return {
        gi,
        depth: r.depth,
        members: r.members,
        meanY: mean,
        spread: Math.max(...ys) - Math.min(...ys),
      }
    }),
  )
  return {
    nodes,
    groups,
    links,
    terminals,
    nodePorts: baseline.nodePorts.map((p) => ({
      ...p,
      ...nodePoint(p.node, p.end, baseline.links[p.li], nodes),
      center: { x: nodes[p.node].x, y: nodes[p.node].y },
    })),
    virtualNodes: finalTracks.map((t) => ({
      ...t,
      x: (t.left + t.right) / 2,
      w: t.right - t.left,
      h: pitch,
    })),
    dependencyOptimization: {
      groups: reports,
      rowAudit,
      objectiveBefore: reports.reduce((s, r) => s + r.before, 0),
      objectiveAfter: reports.reduce((s, r) => s + r.after, 0),
    },
    before: baseline.avoidance.after,
    metrics,
    options: {
      nodeStroke,
      frameStroke,
      areaRatio,
      clearance,
      insets,
      wireWidth: baseline.avoidance.options.wireWidth,
      wireClearanceScale: baseline.avoidance.options.wireClearanceScale,
      lanePitch: pitch,
      portPitch: baseline.avoidance.options.portPitch,
      distributedPorts: true,
      rigidInteriors: false,
      dependencyY: true,
      enforceDepthOrder: false,
    },
    model:
      'Independent node Y and wire-track Y variables. Root-distance-oriented actual internal connections prefer geometry-derived parent/child distances; wire springs prefer short connections. No row target, same-depth Y penalty, original-Y attraction or global depth ordering. Hard node-band / wire-node / overlapping-track clearances. X and route topology retained for this Y-only experiment. Frames are refitted and separated as whole groups; interior/exterior paths are rebuilt.',
    haloProfiles: {
      after: haloProfiles(
        connectionHalos(nodes, groups, links, terminals, nodeStroke, frameStroke, areaRatio),
      ),
    },
    trace: [],
    evaluations: reports.reduce((s, r) => s + r.iterations, 0),
    moved: nodes.flatMap((n, i) => {
      const dx = n.x - baseline.nodes[i].x,
        dy = n.y - baseline.nodes[i].y
      return Math.hypot(dx, dy) > epsilon
        ? [{ id: n.id, dx, dy, distance: Math.hypot(dx, dy) }]
        : []
    }),
  }
}
