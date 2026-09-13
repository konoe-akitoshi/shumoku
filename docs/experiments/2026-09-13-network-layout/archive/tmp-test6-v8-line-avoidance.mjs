import { nodeSideMidpoint } from './tmp-test6-v8-node-attachments.mjs'

// SAT penetration of a segment into an axis-aligned node box (drawing units).
export function segmentPenetration(a, b, n, padding = 0) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    length = Math.hypot(dx, dy)
  if (length < 1e-9) return 0
  const cx = (a.x + b.x) / 2,
    cy = (a.y + b.y) / 2
  const axes = [
    [1, 0],
    [0, 1],
    [-dy / length, dx / length],
  ]
  let depth = Infinity
  for (const [x, y] of axes) {
    const half =
      Math.abs(x) * (n.w / 2 + padding) +
      Math.abs(y) * (n.h / 2 + padding) +
      Math.abs(dx * x + dy * y) / 2
    const overlap = half - Math.abs((n.x - cx) * x + (n.y - cy) * y)
    if (overlap <= 1e-6) return 0
    depth = Math.min(depth, overlap)
  }
  return depth
}

export function refreshNodeEndpoints(baseline, positions) {
  return baseline.links.map((l) => {
    const a = nodeSideMidpoint(
      baseline.nodes,
      positions,
      l.a,
      l.crossGroup ? l.exit : positions[l.b],
    )
    const b = nodeSideMidpoint(
      baseline.nodes,
      positions,
      l.b,
      l.crossGroup ? l.entry : positions[l.a],
    )
    return { ...l, points: l.crossGroup ? [a, ...l.points.slice(1, -1), b] : [a, b] }
  })
}

export function measureLineAvoidance(nodes, links, clearance = 8) {
  let hits = 0,
    nearPairs = 0,
    penalty = 0
  const conflicts = []
  for (const [i, n] of nodes.entries())
    for (const l of links) {
      if (i === l.a || i === l.b) continue
      let actual = 0,
        padded = 0
      for (const [j, b] of l.points.entries()) {
        if (!j) continue
        const a = l.points[j - 1]
        if (
          Math.max(a.x, b.x) < n.x - n.w / 2 - clearance ||
          Math.min(a.x, b.x) > n.x + n.w / 2 + clearance ||
          Math.max(a.y, b.y) < n.y - n.h / 2 - clearance ||
          Math.min(a.y, b.y) > n.y + n.h / 2 + clearance
        )
          continue
        actual = Math.max(actual, segmentPenetration(a, b, n))
        padded = Math.max(padded, segmentPenetration(a, b, n, clearance))
      }
      if (actual > 0) hits++
      if (padded > 0) {
        nearPairs++
        penalty += padded * padded
        conflicts.push({ node: i, link: l.id, penetration: actual, clearancePenetration: padded })
      }
    }
  return { hits, nearPairs, penalty, conflicts }
}

export function optimizeLineAvoidance(
  baseline,
  { maxMove = 24, clearance = 8, anchorWeight = 0.05 } = {},
) {
  const original = baseline.nodes
  const groupOf = new Map(baseline.groups.flatMap((g, gi) => g.members.map((i) => [i, gi])))
  const root = original.findIndex((n) => n.id === 'test:internet')
  function feasible(ps) {
    for (const [i, n] of ps.entries()) {
      const o = original[i],
        g = baseline.groups[groupOf.get(i)]
      if (Math.hypot(n.x - o.x, n.y - o.y) > maxMove + 1e-6) return false
      if (i === root && (n.x !== o.x || n.y !== o.y)) return false
      if (
        n.x - n.w / 2 < g.x - g.w / 2 + 6 - 1e-6 ||
        n.x + n.w / 2 > g.x + g.w / 2 - 6 + 1e-6 ||
        n.y - n.h / 2 < g.y - g.h / 2 + 32 - 1e-6 ||
        n.y + n.h / 2 > g.y + g.h / 2 - 6 + 1e-6
      )
        return false
      for (const j of g.members) {
        if (j === i) continue
        const b = ps[j]
        if (
          Math.abs(n.x - b.x) < (n.w + b.w) / 2 + 4 - 1e-6 &&
          Math.abs(n.y - b.y) < (n.h + b.h) / 2 + 4 - 1e-6
        )
          return false
        if (n.depth < b.depth && n.y + n.h / 2 + 2 > b.y - b.h / 2 + 1e-6) return false
      }
    }
    return true
  }
  let evaluations = 0
  function evaluate(ps) {
    if (!feasible(ps)) return null
    evaluations++
    const links = refreshNodeEndpoints(baseline, ps)
    const metrics = measureLineAvoidance(ps, links, clearance)
    const displacement = ps.reduce(
      (s, n, i) => s + (n.x - original[i].x) ** 2 + (n.y - original[i].y) ** 2,
      0,
    )
    return { nodes: ps, links, metrics, score: metrics.penalty + anchorWeight * displacement }
  }
  let state = evaluate(original.map((n) => ({ ...n })))
  if (!state) throw new Error('Initial layout is not feasible')
  const before = state.metrics
  const trace = []
  for (const step of [12, 8, 4, 2, 1]) {
    for (const sweep of [0, 1, 2, 3]) {
      let accepted = 0
      // Moving either the obstructed node or an endpoint can resolve a collision.
      for (const [i] of original.entries()) {
        if (i === root) continue
        let best = state
        for (const [dx, dy] of [
          [step, 0],
          [-step, 0],
          [0, step],
          [0, -step],
          [step, step],
          [step, -step],
          [-step, step],
          [-step, -step],
        ]) {
          const ps = state.nodes.map((n) => ({ ...n }))
          ps[i].x += dx
          ps[i].y += dy
          const trial = evaluate(ps)
          if (
            trial &&
            (trial.metrics.hits < best.metrics.hits ||
              (trial.metrics.hits === best.metrics.hits && trial.score < best.score - 1e-8))
          )
            best = trial
        }
        if (best !== state) {
          state = best
          accepted++
        }
      }
      trace.push({ step, sweep, accepted, hits: state.metrics.hits, score: state.score })
      if (!accepted) break
    }
  }
  const nodes = state.nodes.map((n, i) => {
    const g = baseline.groups[groupOf.get(i)]
    return { ...n, localX: n.x - g.x, localY: n.y - g.y }
  })
  return {
    ...state,
    nodes,
    before,
    trace,
    evaluations,
    options: { maxMove, clearance, anchorWeight },
    moved: nodes.flatMap((n, i) => {
      const dx = n.x - original[i].x,
        dy = n.y - original[i].y
      return Math.hypot(dx, dy) > 1e-6 ? [{ id: n.id, dx, dy, distance: Math.hypot(dx, dy) }] : []
    }),
  }
}
