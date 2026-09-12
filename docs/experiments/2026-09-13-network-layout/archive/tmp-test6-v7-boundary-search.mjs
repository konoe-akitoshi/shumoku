// Boundary-aware macro optimization: preserve individual node/link dependencies.
import { routeBoundaryConnections } from './tmp-test6-v7-boundary-routing.mjs'
import { groupInteriorMetrics, interiorMetrics } from './tmp-test6-v7-interior-objective.mjs'
import { upstreamContext } from './tmp-test6-v7-upstream.mjs'

const seq = (n) => Array.from({ length: n }, (_, i) => i)
const permute = (xs) =>
  xs.length < 2
    ? [[...xs]]
    : xs.flatMap((x, i) => permute(xs.filter((_, j) => j !== i)).map((rest) => [x, ...rest]))
export function boundaryTerminals(groups, links, positions) {
  const terminals = []
  for (const [li, l] of links.entries()) {
    if (l.ga === l.gb) continue
    for (const [g, other, node, target, end] of [
      [l.ga, l.gb, l.a, l.b, 'a'],
      [l.gb, l.ga, l.b, l.a, 'b'],
    ]) {
      const box = groups[g],
        p = positions[node],
        q = positions[target],
        dx = q.x - p.x,
        dy = q.y - p.y
      const tx =
        Math.abs(dx) > 1e-9 ? (box.x + ((dx > 0 ? 1 : -1) * box.w) / 2 - p.x) / dx : Infinity
      const ty =
        Math.abs(dy) > 1e-9 ? (box.y + ((dy > 0 ? 1 : -1) * box.h) / 2 - p.y) / dy : Infinity
      const t = Math.min(tx, ty),
        side = tx < ty ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'bottom' : 'top'
      terminals.push({
        li,
        g,
        other,
        node,
        end,
        side,
        ideal: tx < ty ? p.y + t * dy : p.x + t * dx,
      })
    }
  }
  for (const [g, A] of groups.entries())
    for (const side of ['left', 'right', 'top', 'bottom']) {
      const ts = terminals
        .filter((t) => t.g === g && t.side === side)
        .sort((a, b) => a.ideal - b.ideal || a.node - b.node || a.li - b.li)
      if (!ts.length) continue
      const vertical = side === 'left' || side === 'right'
      const centre = vertical ? A.y : A.x,
        extent = vertical ? A.h : A.w
      const low = centre - extent / 2 + 18,
        high = centre + extent / 2 - 18
      const spacing = Math.min(10, (high - low) / Math.max(1, ts.length - 1))
      const coords = ts.map((t) => Math.max(low, Math.min(high, t.ideal)))
      for (const i of seq(coords.length).slice(1))
        coords[i] = Math.max(coords[i], coords[i - 1] + spacing)
      if (coords[coords.length - 1] > high) {
        coords[coords.length - 1] = high
        for (const i of seq(coords.length - 1).reverse())
          coords[i] = Math.min(coords[i], coords[i + 1] - spacing)
      }
      for (const [i, t] of ts.entries()) {
        t.x = vertical ? A.x + ((side === 'right' ? 1 : -1) * A.w) / 2 : coords[i]
        t.y = vertical ? coords[i] : A.y + ((side === 'bottom' ? 1 : -1) * A.h) / 2
        t.nx = side === 'right' ? 1 : side === 'left' ? -1 : 0
        t.ny = side === 'bottom' ? 1 : side === 'top' ? -1 : 0
      }
    }
  return terminals
}
function properCross(a, b, c, d) {
  const orient = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
  return orient(a, b, c) * orient(a, b, d) < -1e-6 && orient(c, d, a) * orient(c, d, b) < -1e-6
}
export function connectionMetrics(links, positions, terminals, routed = null) {
  const lookup = new Map(terminals.map((t) => [`${t.li}:${t.end}`, t]))
  const external = []
  let squaredLength = 0,
    totalLength = 0
  for (const [li, l] of links.entries()) {
    let length = 0
    if (l.ga === l.gb)
      length = Math.hypot(positions[l.a].x - positions[l.b].x, positions[l.a].y - positions[l.b].y)
    else {
      const A = lookup.get(`${li}:a`),
        B = lookup.get(`${li}:b`)
      if (!A || !B) throw new Error('Missing boundary endpoint')
      const points = routed ? routed[li].points.slice(1, -1) : [A, B]
      length =
        Math.hypot(positions[l.a].x - A.x, positions[l.a].y - A.y) +
        Math.hypot(positions[l.b].x - B.x, positions[l.b].y - B.y)
      for (const [i, p] of points.entries())
        if (i) length += Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y)
      external.push({ l, points })
    }
    totalLength += length
    squaredLength += length * length
  }
  let crossings = 0
  for (const [i, a] of external.entries())
    for (const b of external.slice(0, i)) {
      // Common physical node endpoints are branches, not independent connections.
      if ([a.l.a, a.l.b].some((n) => n === b.l.a || n === b.l.b)) continue
      let cross = false
      for (const [j, p] of a.points.entries())
        if (j)
          for (const [k, q] of b.points.entries())
            if (k && properCross(a.points[j - 1], p, b.points[k - 1], q)) cross = true
      if (cross) crossings++
    }
  return { crossings, squaredLength, totalLength }
}
function configurations(nodes, groups, links) {
  return groups.map((g, gi) => {
    const internal = links.filter((l) => l.ga === gi && l.gb === gi)
    const memberIndex = new Map(g.members.map((n, i) => [n, i]))
    let orders = [[]]
    for (const level of g.hierarchy.levels)
      orders = orders.flatMap((order) => permute(level).map((row) => [...order, row]))
    return orders.map((levels) => {
      const xy = new Float64Array(g.members.length * 2)
      let top = -g.h / 2 + 44
      for (const [level, row] of levels.entries()) {
        let x = -g.hierarchy.widths[level] / 2
        for (const n of row) {
          const j = memberIndex.get(n)
          xy[2 * j] = x + nodes[n].w / 2
          xy[2 * j + 1] = top + g.hierarchy.heights[level] / 2
          x += nodes[n].w + 18
        }
        top += g.hierarchy.heights[level] + 20
      }
      let cost = 0
      for (const l of internal) {
        const a = memberIndex.get(l.a),
          b = memberIndex.get(l.b)
        cost += (xy[2 * a] - xy[2 * b]) ** 2 + (xy[2 * a + 1] - xy[2 * b + 1]) ** 2
      }
      return { xy, cost, levels }
    })
  })
}
export async function optimizeBoundaryLayout({
  nodes,
  groups,
  links,
  rootGroup,
  inputHash,
  upstreamRoot = null,
  rootedInterior = false,
  warmStartPath = null,
  enforceGroupOrder = true,
}) {
  const configs = configurations(nodes, groups, links)
  let baseline = await Bun.file(
    rootedInterior
      ? 'tmp-test6-v7-internet-upstream-report.json'
      : upstreamRoot === null
        ? 'tmp-test6-v7-tree-report.json'
        : 'tmp-test6-v7-boundary-optimized-report.json',
  ).json()
  if (baseline.inputHash !== inputHash) throw new Error('Input differs from baseline')
  const normalizationFast = rootedInterior
    ? {
        ...connectionMetrics(links, baseline.nodes, baseline.terminals),
        ...interiorMetrics(nodes, baseline.groups, links, baseline.nodes, baseline.terminals),
      }
    : null
  const normalizationRouted = rootedInterior
    ? {
        ...connectionMetrics(links, baseline.nodes, baseline.terminals, baseline.links),
        ...interiorMetrics(nodes, baseline.groups, links, baseline.nodes, baseline.terminals),
      }
    : null
  const previousInterior = rootedInterior
    ? interiorMetrics(nodes, baseline.groups, links, baseline.nodes, baseline.terminals)
    : null
  if (warmStartPath) {
    const seed = await Bun.file(warmStartPath).json()
    if (
      seed.inputHash !== inputHash ||
      groups.some(
        (g, i) =>
          g.id !== seed.groups[i].id || g.w !== seed.groups[i].w || g.h !== seed.groups[i].h,
      )
    )
      throw new Error('Incompatible warm start')
    baseline = seed
  }
  if (
    groups.some(
      (g, i) =>
        g.id !== baseline.groups[i].id ||
        (!rootedInterior && (g.w !== baseline.groups[i].w || g.h !== baseline.groups[i].h)),
    )
  )
    throw new Error('Hierarchy dimensions changed')
  let initial = Float64Array.from(baseline.groups.flatMap((g) => [g.x, g.y]))
  const upstream =
    upstreamRoot === null
      ? null
      : upstreamContext(
          groups,
          links,
          nodes.length,
          upstreamRoot,
          rootGroup,
          initial,
          enforceGroupOrder,
        )
  if (upstream) {
    initial = warmStartPath ? upstream.project(initial) : upstream.initial
    const newGroups = groups.map((g, i) => ({ ...g, x: initial[2 * i], y: initial[2 * i + 1] }))
    const nodeGroups = new Map(groups.flatMap((g, i) => g.members.map((n) => [n, i])))
    const newNodes = baseline.nodes.map((n, i) => {
      const gi = nodeGroups.get(i),
        old = baseline.groups[gi],
        g = newGroups[gi]
      return { ...n, x: n.x - old.x + g.x, y: n.y - old.y + g.y }
    })
    if (rootedInterior) {
      for (const [gi, g] of newGroups.entries()) {
        const levels = g.hierarchy.levels.map((row) =>
          [...row].sort((a, b) => baseline.nodes[a].x - baseline.nodes[b].x || a - b),
        )
        const config = configs[gi].find((c) => JSON.stringify(c.levels) === JSON.stringify(levels))
        if (!config) throw new Error('Missing rooted baseline order')
        for (const [j, i] of g.members.entries())
          newNodes[i] = { ...newNodes[i], x: g.x + config.xy[2 * j], y: g.y + config.xy[2 * j + 1] }
      }
    }
    const newTerminals = boundaryTerminals(newGroups, links, newNodes)
    const newRoutes = routeBoundaryConnections({
      groups: newGroups,
      nodes,
      links,
      positions: newNodes,
      terminals: newTerminals,
    })
    baseline = {
      ...baseline,
      groups: newGroups,
      nodes: newNodes,
      terminals: newTerminals,
      links: links.map((l, i) => ({ ...l, ...newRoutes[i] })),
    }
  }
  const measure = (positions, terminals, routed = null) => ({
    ...connectionMetrics(links, positions, terminals, routed),
    ...(rootedInterior ? interiorMetrics(nodes, groups, links, positions, terminals) : {}),
  })
  const originalMetrics = measure(baseline.nodes, baseline.terminals)
  const startChoices = configs.map((cs, gi) => {
    const g = groups[gi],
      b = baseline.groups[gi]
    const found = cs.findIndex((c) =>
      g.members.every((i, j) => Math.abs(c.xy[2 * j] - (baseline.nodes[i].x - b.x)) < 1e-6),
    )
    return found >= 0 ? found : 0
  })
  const scoreAgainst = (m, reference) =>
    rootedInterior
      ? (m.crossings + m.internalCrossings) /
          Math.max(1, reference.crossings + reference.internalCrossings) +
        m.internalNodeHits / Math.max(1, reference.internalNodeHits) +
        m.internalOverlaps / Math.max(1, reference.internalOverlaps) +
        m.squaredLength / reference.squaredLength
      : m.crossings / Math.max(1, reference.crossings) + m.squaredLength / reference.squaredLength
  const fastReference = normalizationFast ?? originalMetrics
  const ratios = (m) => scoreAgainst(m, fastReference)
  const internals = groups.map((_, g) => links.filter((l) => l.ga === g && l.gb === g))
  const groupNeighbors = groups.map(() => new Set())
  for (const l of links)
    if (l.ga !== l.gb) {
      groupNeighbors[l.ga].add(l.gb)
      groupNeighbors[l.gb].add(l.ga)
    }
  const subsets = groups.map((_, g) => [g, ...groupNeighbors[g]].filter((i) => i !== rootGroup))
  subsets.push(seq(groups.length).filter((i) => i !== rootGroup))
  let evaluated = 0,
    proposed = 0
  function feasible(z) {
    for (const [a, A] of groups.entries())
      for (const b of seq(a)) {
        const B = groups[b]
        // Existing exterior router needs 10px clearance on each side.
        if (
          Math.abs(z[2 * a] - z[2 * b]) < (A.w + B.w) / 2 + 20.001 - 1e-6 &&
          Math.abs(z[2 * a + 1] - z[2 * b + 1]) < (A.h + B.h) / 2 + 20.001 - 1e-6
        )
          return false
      }
    return true
  }
  function evaluate(input) {
    const z = upstream ? upstream.project(input) : input
    proposed++
    if (!feasible(z)) return null
    evaluated++
    const boxes = groups.map((g, i) => ({ ...g, x: z[2 * i], y: z[2 * i + 1] }))
    let choices = [...startChoices],
      best = null
    // Short discrete alternating search: boundary endpoints <-> interior sibling ordering.
    // All candidates use the same deterministic starting orders and number of passes.
    for (const _round of seq(3)) {
      const positions = nodes.map(() => ({ x: 0, y: 0 }))
      for (const [g, b] of boxes.entries()) {
        const config = configs[g][choices[g]]
        for (const [j, i] of b.members.entries())
          positions[i] = { x: b.x + config.xy[2 * j], y: b.y + config.xy[2 * j + 1] }
      }
      const terminals = boundaryTerminals(boxes, links, positions)
      const metrics = measure(positions, terminals)
      const score = ratios(metrics)
      if (!best || score < best.score)
        best = { z: z.slice(), positions, terminals, choices: [...choices], metrics, score }
      const next = []
      const lookup = new Map(terminals.map((t) => [`${t.li}:${t.end}`, t]))
      for (const [g, b] of boxes.entries()) {
        if (rootedInterior) {
          const external = terminals
            .filter((t) => t.g === g)
            .map((t) => {
              const other = lookup.get(`${t.li}:${t.end === 'a' ? 'b' : 'a'}`)
              if (!other) throw new Error('Missing other terminal')
              const p = positions[other.node]
              return {
                ...t,
                tailLength:
                  Math.hypot(t.x - other.x, t.y - other.y) +
                  Math.hypot(p.x - other.x, p.y - other.y),
              }
            })
          let min = Infinity,
            selected = choices[g]
          const trialPositions = [...positions]
          for (const [ci, c] of configs[g].entries()) {
            for (const [j, i] of b.members.entries())
              trialPositions[i] = { x: b.x + c.xy[2 * j], y: b.y + c.xy[2 * j + 1] }
            const m = groupInteriorMetrics(nodes, b.members, internals[g], external, trialPositions)
            const cost =
              m.crossings / Math.max(1, fastReference.crossings + fastReference.internalCrossings) +
              m.nodeHits / Math.max(1, fastReference.internalNodeHits) +
              m.overlaps / Math.max(1, fastReference.internalOverlaps) +
              m.squaredLength / fastReference.squaredLength
            if (cost < min - 1e-12) {
              min = cost
              selected = ci
            }
          }
          next.push(selected)
          continue
        }
        const sums = new Map(b.members.map((i) => [i, { n: 0, x: 0, y: 0 }]))
        for (const t of terminals)
          if (t.g === g) {
            const s = sums.get(t.node)
            s.n++
            s.x += t.x - b.x
            s.y += t.y - b.y
          }
        let min = Infinity,
          selected = choices[g]
        for (const [ci, c] of configs[g].entries()) {
          let cost = c.cost
          for (const [j, i] of b.members.entries()) {
            const s = sums.get(i),
              x = c.xy[2 * j],
              y = c.xy[2 * j + 1]
            cost += s.n * (x * x + y * y) - 2 * (x * s.x + y * s.y)
          }
          if (cost < min) {
            min = cost
            selected = ci
          }
        }
        next.push(selected)
      }
      if (next.every((v, i) => v === choices[i])) break
      choices = next
    }
    return best
  }
  let state = evaluate(initial)
  if (!state) throw new Error('Baseline is not router-feasible')
  const fixedPlacementRescored = { ...state.metrics, score: state.score }
  let best = state
  const initialScores = {
    original: originalMetrics,
    originalScore: ratios(originalMetrics),
    withNewTerminals: fixedPlacementRescored,
  }
  let rng = 120671
  const random = () => {
    rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0
    return rng / 4294967296
  }
  const stats = {}
  const trace = []
  const shortlist = []
  function accept(candidate, kind, temperature = 0) {
    const s = stats[kind] ?? { proposed: 0, feasible: 0, accepted: 0, uphill: 0 }
    stats[kind] = s
    s.proposed++
    if (!candidate) return
    s.feasible++
    if (candidate.score < best.score) best = candidate
    const delta = candidate.score - state.score
    if (delta < 0 || (temperature > 0 && random() < Math.exp(-delta / temperature))) {
      state = candidate
      s.accepted++
      if (delta > 0) s.uphill++
    }
  }
  for (const sweep of seq(64)) {
    // Radial and circular-arc coordinate moves at decreasing scales, no fixed rings.
    const step = [256, 128, 64, 32][sweep % 4]
    for (const g of seq(groups.length)) {
      if (g === rootGroup) continue
      for (const axis of ['radius', 'angle'])
        for (const sign of [-1, 1]) {
          const z = state.z.slice(),
            r = Math.hypot(z[2 * g], z[2 * g + 1]),
            theta = Math.atan2(z[2 * g + 1], z[2 * g])
          const nr = axis === 'radius' ? Math.abs(r + sign * step) : r
          const nt = axis === 'angle' ? theta + sign * Math.min(0.7, step / Math.max(1, r)) : theta
          z[2 * g] = nr * Math.cos(nt)
          z[2 * g + 1] = nr * Math.sin(nt)
          accept(evaluate(z), axis)
        }
    }
    // Move connected neighborhoods together so individual boxes do not lock one another.
    for (const members of subsets)
      for (const [dx, dy] of [
        [step, 0],
        [-step, 0],
        [0, step],
        [0, -step],
      ]) {
        const z = state.z.slice()
        for (const g of members) {
          z[2 * g] += dx
          z[2 * g + 1] += dy
        }
        accept(evaluate(z), 'connected-block')
      }
    // Direct angular-order changes and relocations, including occasional temporary worsening.
    for (const _trial of seq(90)) {
      const a = Math.floor(random() * groups.length),
        b = Math.floor(random() * groups.length)
      if (a === b || a === rootGroup || b === rootGroup) continue
      const z = state.z.slice()
      const kind = _trial % 2 === 0 ? 'angle-swap' : 'relocation'
      if (kind === 'angle-swap') {
        const ra = Math.hypot(z[2 * a], z[2 * a + 1]),
          rb = Math.hypot(z[2 * b], z[2 * b + 1])
        const ta = Math.atan2(z[2 * a + 1], z[2 * a]),
          tb = Math.atan2(z[2 * b + 1], z[2 * b])
        z[2 * a] = ra * Math.cos(tb)
        z[2 * a + 1] = ra * Math.sin(tb)
        z[2 * b] = rb * Math.cos(ta)
        z[2 * b + 1] = rb * Math.sin(ta)
      } else {
        const angle = random() * Math.PI * 2,
          distance = step * (1 + random() * 4)
        z[2 * a] += Math.cos(angle) * distance
        z[2 * a + 1] += Math.sin(angle) * distance
      }
      accept(evaluate(z), kind, 0.008 * (1 - sweep / 64))
    }
    if (sweep % 4 === 3) {
      state = best
      shortlist.push(best)
    }
    trace.push({ sweep, proposed, evaluated, score: best.score, ...best.metrics })
    if (sweep % 4 === 3) {
      const { groups: _groups, ...progress } = trace[trace.length - 1]
      console.log('boundary-search', JSON.stringify(progress))
    }
  }
  const originalRouted = measure(baseline.nodes, baseline.terminals, baseline.links)
  const routedReference = normalizationRouted ?? originalRouted
  const routedScore = (m) => scoreAgainst(m, routedReference)
  // The old rendered diagram is an explicit fallback, not just a fast-score baseline.
  let selected = {
    z: initial,
    positions: baseline.nodes,
    terminals: baseline.terminals,
    choices: startChoices,
    metrics: originalMetrics,
    score: ratios(originalMetrics),
  }
  let selectedRouted = originalRouted
  let selectedScore = routedScore(originalRouted)
  const routedCandidates = []
  const uniqueCandidates = [...new Map(shortlist.map((c) => [c.score, c])).values()]
  for (const candidate of uniqueCandidates) {
    const candidateBoxes = groups.map((g, i) => ({
      ...g,
      x: candidate.z[2 * i],
      y: candidate.z[2 * i + 1],
    }))
    const routed = routeBoundaryConnections({
      groups: candidateBoxes,
      nodes,
      links,
      positions: candidate.positions,
      terminals: candidate.terminals,
    })
    const metrics = measure(candidate.positions, candidate.terminals, routed)
    const score = routedScore(metrics)
    routedCandidates.push({ fastScore: candidate.score, routedScore: score, ...metrics })
    if (score < selectedScore) {
      selected = candidate
      selectedRouted = metrics
      selectedScore = score
    }
  }
  console.log(
    'routed-selection',
    JSON.stringify({
      original: originalRouted,
      selected: selectedRouted,
      score: selectedScore,
      candidates: uniqueCandidates.length,
    }),
  )
  return {
    ...selected,
    seed: 'boundary-search',
    cost: selectedScore,
    levels: groups.map((_, g) => configs[g][selected.choices[g]].levels),
    diagnostics: {
      rootedInterior,
      enforceGroupOrder,
      warmStartPath,
      normalizationFast,
      normalizationRouted,
      initialRoutedScore: routedScore(originalRouted),
      previousInterior,
      upstream: upstream
        ? {
            rootNode: nodes[upstreamRoot].id,
            rootGroup: groups[rootGroup].id,
            groupDepths: upstream.rank,
            nodeDistances: upstream.distances,
            parents: upstream.parents,
            violations: upstream.violations(selected.z),
            meaning: !enforceGroupOrder
              ? 'Only the explicit root group remains above the other groups. Group-to-group whole-frame vertical order is disabled; ranks and parent relations are diagnostic only. Interior root-distance hierarchy and all links are preserved.'
              : rootedInterior
                ? 'Group and node order derive from the explicit root. Interior rows preserve global BFS distance order, compressing unused local depths; all internal upstream dependencies are retained, peers stay at equal depth.'
                : 'Group rank is earliest reachable member distance from explicit root. Higher-rank adjacent groups are below lower-rank groups. Equal-rank links remain peer links. This is display direction, not inferred traffic direction. Existing interior hierarchy is unchanged.',
          }
        : null,
      initialScores,
      final: selected.metrics,
      finalScore: selectedScore,
      originalRouted,
      selectedRouted,
      routedCandidates,
      fastSearchBest: best.metrics,
      proposed,
      evaluated,
      stats,
      trace,
      configCounts: configs.map((cs) => cs.length),
      scoreDefinition: rootedInterior
        ? '(exterior + interior crossings) / baseline crossings + internal node hits / baseline hits + internal overlaps / baseline overlaps + squared complete link length / baseline squared length; count denominators at least 1, equal normalized weights. Baseline denominators are frozen to the previous Internet-upstream diagram, not a newly expanded or warm-start placement.'
        : 'crossingPairs / originalCrossingPairs + squaredConnectionPathLengths / originalSquaredLengths; equal baseline-relative weights',
      crossingDefinition: rootedInterior
        ? 'Internal crossings count clipped wire/stub pairs per group, excluding endpoint touches; overlaps are separate collinear segment-pair counts. Exterior crossings count proper link-pair intersections (excluding common physical endpoints), straight spans in fast search and rendered polylines in final ranking. Internal and exterior intersection events are added, not deduplicated across groups.'
        : 'Fast stage uses straight boundary segments; final selection uses actual rendered exterior polylines. Proper crossings only, excluding links sharing an actual node. Each link-pair counted once; collinear overlap excluded.',
      lengthDefinition:
        'Every original link: source node centre -> source boundary -> target boundary -> target node centre; squared sum per link. Internal links use node-centre distance.',
      limits: rootedInterior
        ? 'Fixed root-distance hierarchy, one row per depth. Exhaustive row-order combinations per group with fixed terminals, 3 alternating passes, 64 macro sweeps, routed shortlist. Internal geometry includes node-boundary stubs. No global optimum claim; same-depth wires remain straight, so some occlusion/overlap may be unavoidable without changing the geometry model.'
        : '3 alternating terminal/order passes per candidate, 64 mixed search sweeps; checkpoint shortlist re-ranked with actual renderer routes and corresponding original-routed baseline. No global optimality claim. Shared-path overlap and internal node occlusion are not optimized.',
    },
  }
}
