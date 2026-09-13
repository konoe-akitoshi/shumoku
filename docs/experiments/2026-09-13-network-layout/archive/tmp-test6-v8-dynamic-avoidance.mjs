import { measureLineAvoidance, refreshNodeEndpoints } from './tmp-test6-v8-line-avoidance.mjs'

const orient = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
export function measureWires(links) {
  const segments = []
  let length = 0,
    overlapLength = 0
  for (const [li, l] of links.entries())
    for (const [j, b] of l.points.entries())
      if (j) {
        const a = l.points[j - 1],
          len = Math.hypot(b.x - a.x, b.y - a.y)
        length += len
        if (len > 1e-9)
          segments.push({
            li,
            a,
            b,
            len,
            minX: Math.min(a.x, b.x),
            maxX: Math.max(a.x, b.x),
            minY: Math.min(a.y, b.y),
            maxY: Math.max(a.y, b.y),
          })
      }
  segments.sort((a, b) => a.minX - b.minX)
  const crossings = new Set()
  for (const [i, s] of segments.entries())
    for (const t of segments.slice(i + 1)) {
      if (t.minX > s.maxX + 1e-6) break
      if (s.li === t.li || t.minY > s.maxY + 1e-6 || t.maxY < s.minY - 1e-6) continue
      const oa = orient(s.a, s.b, t.a),
        ob = orient(s.a, s.b, t.b)
      if (oa * ob < -1e-6 && orient(t.a, t.b, s.a) * orient(t.a, t.b, s.b) < -1e-6)
        crossings.add([s.li, t.li].sort((a, b) => a - b).join(':'))
      if (Math.abs(oa) > 1e-6 || Math.abs(ob) > 1e-6) continue
      const dx = (s.b.x - s.a.x) / s.len,
        dy = (s.b.y - s.a.y) / s.len
      const p = (t.a.x - s.a.x) * dx + (t.a.y - s.a.y) * dy,
        q = (t.b.x - s.a.x) * dx + (t.b.y - s.a.y) * dy
      overlapLength += Math.max(0, Math.min(s.len, Math.max(p, q)) - Math.max(0, Math.min(p, q)))
    }
  return { crossings: crossings.size, overlapLength, length }
}

// Exact separation events derived from segment/rectangle geometry, not pixel steps.
export function separationMoves(a, b, n, padding) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    len = Math.hypot(dx, dy)
  if (len < 1e-9) return []
  const cx = (a.x + b.x) / 2,
    cy = (a.y + b.y) / 2
  return [
    [1, 0],
    [0, 1],
    [-dy / len, dx / len],
  ].flatMap(([x, y]) => {
    const half =
      Math.abs(x) * (n.w / 2 + padding) +
      Math.abs(y) * (n.h / 2 + padding) +
      Math.abs(dx * x + dy * y) / 2
    const offset = (n.x - cx) * x + (n.y - cy) * y
    if (Math.abs(offset) >= half) return []
    return [half - offset, -half - offset].map((d) => ({ dx: x * d, dy: y * d }))
  })
}

export function optimizeDynamicAvoidance(baseline, svg, { maxSweeps = 12 } = {}) {
  const original = baseline.nodes
  const widths = [...svg.matchAll(/<path data-link="[^>]*stroke-width="([\d.]+)"/g)].map((m) =>
    Number(m[1]),
  )
  if (!widths.length) throw new Error('Missing measured SVG wire widths')
  const wireWidth = Math.max(...widths)
  const nodeRects = [...svg.matchAll(/<g data-node="[^>]*><rect\b([^>]*)>/g)]
  if (nodeRects.length !== original.length) throw new Error('Missing displayed node rectangles')
  const nodeStroke = Math.max(
    ...nodeRects.map((m) => Number(m[1].match(/stroke-width="([\d.]+)"/)?.[1] ?? 1)),
  )
  const clearance = (wireWidth + nodeStroke) / 2
  const groupOf = new Map(baseline.groups.flatMap((g, gi) => g.members.map((i) => [i, gi])))
  // Retain the existing title region; no new fixed top padding.
  const contentTop = baseline.groups.map((g) =>
    Math.min(...g.members.map((i) => original[i].y - original[i].h / 2)),
  )
  const root = original.findIndex((n) => n.id === 'test:internet')
  function feasible(ps) {
    for (const [i, n] of ps.entries()) {
      const gi = groupOf.get(i),
        g = baseline.groups[gi],
        edge = nodeStroke / 2
      if (i === root && (n.x !== original[i].x || n.y !== original[i].y)) return false
      if (
        n.x - n.w / 2 < g.x - g.w / 2 + edge - 1e-6 ||
        n.x + n.w / 2 > g.x + g.w / 2 - edge + 1e-6 ||
        n.y - n.h / 2 < contentTop[gi] - 1e-6 ||
        n.y + n.h / 2 > g.y + g.h / 2 - edge + 1e-6
      )
        return false
      for (const j of g.members) {
        if (j === i) continue
        const b = ps[j]
        if (
          Math.abs(n.x - b.x) < (n.w + b.w) / 2 + nodeStroke - 1e-6 &&
          Math.abs(n.y - b.y) < (n.h + b.h) / 2 + nodeStroke - 1e-6
        )
          return false
        if (n.depth < b.depth && n.y + n.h / 2 + nodeStroke > b.y - b.h / 2 + 1e-6) return false
      }
    }
    return true
  }
  const measure = (ps, ls) => ({ ...measureLineAvoidance(ps, ls, clearance), ...measureWires(ls) })
  const reference = measure(original, baseline.links)
  const ratios = (m) =>
    m.penalty / Math.max(1, reference.penalty) +
    m.crossings / Math.max(1, reference.crossings) +
    m.overlapLength / Math.max(1, reference.overlapLength) +
    m.length / Math.max(1, reference.length)
  let evaluations = 0
  function evaluate(ps) {
    if (!feasible(ps)) return null
    evaluations++
    const links = refreshNodeEndpoints(baseline, ps),
      metrics = measure(ps, links)
    return {
      nodes: ps,
      links,
      metrics,
      score: ratios(metrics),
      displacement: ps.reduce(
        (s, n, i) => s + (n.x - original[i].x) ** 2 + (n.y - original[i].y) ** 2,
        0,
      ),
    }
  }
  let state = evaluate(original.map((n) => ({ ...n })))
  if (!state) throw new Error('Invalid initial geometry')
  const trace = []
  for (const sweep of Array.from({ length: maxSweeps }, (_, i) => i)) {
    let accepted = 0
    for (const [i] of original.entries()) {
      if (i === root) continue
      const n = state.nodes[i],
        moves = []
      for (const c of state.metrics.conflicts.filter((c) => c.node === i)) {
        const l = state.links.find((l) => l.id === c.link)
        for (const [j, b] of l.points.entries())
          if (j) moves.push(...separationMoves(l.points[j - 1], b, n, clearance))
      }
      const targets = state.links.flatMap((l) =>
        l.a === i
          ? [l.crossGroup ? l.exit : state.nodes[l.b]]
          : l.b === i
            ? [l.crossGroup ? l.entry : state.nodes[l.a]]
            : [],
      )
      if (targets.length)
        moves.push({
          dx: targets.reduce((s, p) => s + p.x, 0) / targets.length - n.x,
          dy: targets.reduce((s, p) => s + p.y, 0) / targets.length - n.y,
        })
      moves.push({ dx: original[i].x - n.x, dy: original[i].y - n.y })
      let best = state
      for (const move of moves) {
        let lo = 0,
          hi = 1
        const positions = (f) =>
          state.nodes.map((v, j) =>
            j === i ? { ...v, x: v.x + move.dx * f, y: v.y + move.dy * f } : v,
          )
        if (!feasible(positions(hi))) {
          // Feasible prefix backtracking; numerical iterations are not pixel limits.
          for (const _ of Array.from({ length: 20 })) {
            const mid = (lo + hi) / 2
            if (feasible(positions(mid))) lo = mid
            else hi = mid
          }
          hi = lo
        }
        for (const factor of [hi, hi / 2]) {
          if (Math.hypot(move.dx * factor, move.dy * factor) < 1e-6) continue
          const trial = evaluate(positions(factor))
          if (
            trial &&
            (trial.metrics.hits < best.metrics.hits ||
              (trial.metrics.hits === best.metrics.hits &&
                (trial.score < best.score - 1e-8 ||
                  (Math.abs(trial.score - best.score) < 1e-8 &&
                    trial.displacement < best.displacement))))
          )
            best = trial
        }
      }
      if (best !== state) {
        state = best
        accepted++
      }
    }
    trace.push({
      sweep,
      accepted,
      hits: state.metrics.hits,
      crossings: state.metrics.crossings,
      overlapLength: state.metrics.overlapLength,
      length: state.metrics.length,
      score: state.score,
    })
    console.log('dynamic', JSON.stringify(trace.at(-1)))
    if (!accepted) break
  }
  const nodes = state.nodes.map((n, i) => {
    const g = baseline.groups[groupOf.get(i)]
    return { ...n, localX: n.x - g.x, localY: n.y - g.y }
  })
  return {
    ...state,
    nodes,
    before: reference,
    trace,
    evaluations,
    model:
      'Geometry-derived displacement proposals; no fixed pixel movement cap or 8px buffer. Minimize node/link hits first, then equal initial-relative penetration, link-pair crossings, collinear overlap length and actual wire length. Displacement only breaks ties. Fixed frames and inherited title region remain constraints.',
    options: { wireWidth, nodeStroke, clearance, maxSweeps, normalization: reference },
    moved: nodes.flatMap((n, i) => {
      const dx = n.x - original[i].x,
        dy = n.y - original[i].y
      return Math.hypot(dx, dy) > 1e-6 ? [{ id: n.id, dx, dy, distance: Math.hypot(dx, dy) }] : []
    }),
  }
}
