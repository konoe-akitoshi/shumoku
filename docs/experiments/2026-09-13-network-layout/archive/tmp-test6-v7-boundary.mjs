import { createHash } from 'node:crypto'
import { routeBoundaryConnections, segmentHits } from './tmp-test6-v7-boundary-routing.mjs'
import { connectionMetrics, optimizeBoundaryLayout } from './tmp-test6-v7-boundary-search.mjs'
import { interiorMetrics } from './tmp-test6-v7-interior-objective.mjs'
import { deriveRootedTreeSizes, deriveTreeSizes, placeTree } from './tmp-test6-v7-tree-layout.mjs'

// V7: fixed subgraph boundaries -> boundary terminals -> independent internal placement.
// Deliberately separate from previous joint optimizers and the production engine.
const inputPath = 'tmp-test6-complete-upstream-to-ap.json'
const inputText = await Bun.file(inputPath).text()
const graph = JSON.parse(inputText)
const upstreamFlag = process.argv.indexOf('--upstream')
const upstreamRootId = upstreamFlag < 0 ? null : process.argv[upstreamFlag + 1]
const rootedInterior = process.argv.includes('--rooted-interior')
const refineRooted = process.argv.includes('--refine-rooted')
const freeGroups = process.argv.includes('--free-groups')
if (freeGroups && !rootedInterior) throw new Error('--free-groups needs --rooted-interior')
if (refineRooted && !rootedInterior) throw new Error('--refine-rooted needs --rooted-interior')
if (rootedInterior && !upstreamRootId) throw new Error('--rooted-interior needs --upstream')
if (upstreamFlag >= 0 && (!upstreamRootId || upstreamRootId.startsWith('--'))) {
  throw new Error('--upstream requires a node ID')
}
const boundarySearch = upstreamRootId !== null || process.argv.includes('--boundary-search')
const treeInterior = boundarySearch || process.argv.includes('--tree')
const polarMacro = treeInterior || process.argv.includes('--polar')
const outputBase = freeGroups
  ? 'tmp-test6-v7-free-groups'
  : refineRooted
    ? 'tmp-test6-v7-rooted-interior-refined'
    : rootedInterior
      ? 'tmp-test6-v7-rooted-interior'
      : upstreamRootId
        ? 'tmp-test6-v7-internet-upstream'
        : boundarySearch
          ? 'tmp-test6-v7-boundary-optimized'
          : treeInterior
            ? 'tmp-test6-v7-tree'
            : polarMacro
              ? 'tmp-test6-v7-polar'
              : 'tmp-test6-v7-boundary'
const seq = (n) => Array.from({ length: n }, (_, i) => i)
const nodes = [...graph.nodes]
  .sort((a, b) => a.id.localeCompare(b.id))
  .map((n) => ({
    id: n.id,
    label: n.label,
    parent: n.parent,
    role: n.metadata?.topologyRole ?? 'unknown',
    w: Math.max(132, n.label.length * 7.2 + 24),
    h: 48,
  }))
const index = new Map(nodes.map((n, i) => [n.id, i]))
let groups = [...graph.subgraphs]
  .filter((g) => nodes.some((n) => n.parent === g.id))
  .sort((a, b) => a.id.localeCompare(b.id))
  .map((g) => {
    const members = nodes.flatMap((n, i) => (n.parent === g.id ? [i] : []))
    if (treeInterior) return { id: g.id, label: g.label, members }
    const columns = Math.ceil(Math.sqrt(members.length))
    const rows = Math.ceil(members.length / columns)
    const cellWidth = Math.max(...members.map((i) => nodes[i].w)) + 30
    const cellHeight = 84
    // Capacity estimate, not internal placement: reserve room before macro layout.
    const w = Math.max(columns * cellWidth + 48, g.label.length * 7 + 48)
    const h = rows * cellHeight + 80
    return { id: g.id, label: g.label, members, columns, rows, cellWidth, cellHeight, w, h }
  })
const groupOf = new Map(groups.flatMap((g, j) => g.members.map((i) => [i, j])))
if (groupOf.size !== nodes.length) throw new Error('Every node needs exactly one displayed parent')
const links = graph.links.map((l) => {
  const a = index.get(l.from.node),
    b = index.get(l.to.node)
  if (a === undefined || b === undefined) throw new Error('Unresolved endpoint')
  return { id: l.id, a, b, ga: groupOf.get(a), gb: groupOf.get(b), role: l.metadata?.topologyRole }
})
const root = index.get(upstreamRootId ?? 'test:internet')
if (root === undefined) throw new Error(`Missing anchor: ${upstreamRootId}`)
const rootGroup = groupOf.get(root)
if (treeInterior)
  groups = rootedInterior
    ? deriveRootedTreeSizes(nodes, groups, links, root)
    : deriveTreeSizes(nodes, groups, links, root)
const macroMap = new Map()
const uniqueNodes = new Set()
for (const l of links) {
  const nodeKey = [l.a, l.b].sort((a, b) => a - b).join(':')
  if (uniqueNodes.has(nodeKey)) continue
  uniqueNodes.add(nodeKey)
  if (l.ga === l.gb) continue
  const key = [l.ga, l.gb].sort((a, b) => a - b).join(':')
  const relation = macroMap.get(key) ?? { a: l.ga, b: l.gb, weight: 0 }
  relation.weight++
  macroMap.set(key, relation)
}
const macroLinks = [...macroMap.values()]
const randomSource = (seed) => {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}
const shuffle = (items, random) => {
  const values = [...items]
  for (const i of seq(values.length).reverse()) {
    const j = Math.floor(random() * (i + 1))
    const saved = values[i]
    values[i] = values[j]
    values[j] = saved
  }
  return values
}
function gradientCheck(evaluate, probe) {
  const analytical = evaluate(probe)
  let error = 0
  for (const i of seq(probe.length)) {
    const plus = probe.slice()
    const minus = probe.slice()
    const epsilon = 0.0001
    plus[i] += epsilon
    minus[i] -= epsilon
    const numeric = (evaluate(plus, false).cost - evaluate(minus, false).cost) / (2 * epsilon)
    error = Math.max(
      error,
      Math.abs(numeric - analytical.d[i]) /
        Math.max(1, Math.abs(numeric), Math.abs(analytical.d[i])),
    )
  }
  if (error > 0.002) throw new Error(`Gradient mismatch: ${error}`)
  return error
}
function macroEvaluate(z, gradient = true) {
  const d = new Float64Array(z.length),
    curvature = new Float64Array(z.length).fill(0.1)
  const losses = {}
  const add = (name, value, weight, terms) => {
    losses[name] = (losses[name] ?? 0) + weight * value * value
    if (gradient)
      for (const [i, v] of terms) {
        d[i] += 2 * weight * value * v
        curvature[i] += 2 * weight * v * v
      }
  }
  for (const e of macroLinks) {
    add('dependency-x', z[2 * e.a] - z[2 * e.b], e.weight, [
      [2 * e.a, 1],
      [2 * e.b, -1],
    ])
    add('dependency-y', z[2 * e.a + 1] - z[2 * e.b + 1], e.weight, [
      [2 * e.a + 1, 1],
      [2 * e.b + 1, -1],
    ])
  }
  for (const [a, A] of groups.entries())
    for (const b of seq(a)) {
      const B = groups[b],
        dx = z[2 * a] - z[2 * b],
        dy = z[2 * a + 1] - z[2 * b + 1]
      const ox = (A.w + B.w) / 2 + 72 - Math.abs(dx),
        oy = (A.h + B.h) / 2 + 72 - Math.abs(dy)
      if (ox <= 0 || oy <= 0) continue
      // Piecewise exact separating-axis overlap cost; compare many discrete arrangements.
      if (ox < oy)
        add('group-overlap', ox, 5000, [
          [2 * a, -(Math.sign(dx) || 1)],
          [2 * b, Math.sign(dx) || 1],
        ])
      else
        add('group-overlap', oy, 5000, [
          [2 * a + 1, -(Math.sign(dy) || 1)],
          [2 * b + 1, Math.sign(dy) || 1],
        ])
    }
  return { cost: Object.values(losses).reduce((a, b) => a + b, 0), d, curvature, losses }
}
function macroOverlap(z, padding = 0) {
  let count = 0
  for (const [a, A] of groups.entries())
    for (const b of seq(a)) {
      const B = groups[b]
      if (
        Math.abs(z[2 * a] - z[2 * b]) < (A.w + B.w) / 2 + padding &&
        Math.abs(z[2 * a + 1] - z[2 * b + 1]) < (A.h + B.h) / 2 + padding
      )
        count++
    }
  return count
}
function toPolar(z) {
  return Float64Array.from(z, (_, i) => {
    const g = Math.floor(i / 2)
    return i % 2 === 0 ? Math.hypot(z[2 * g], z[2 * g + 1]) : Math.atan2(z[2 * g + 1], z[2 * g])
  })
}
function fromPolar(p) {
  return Float64Array.from(p, (_, i) => {
    const g = Math.floor(i / 2)
    return p[2 * g] * (i % 2 === 0 ? Math.cos(p[2 * g + 1]) : Math.sin(p[2 * g + 1]))
  })
}
function polarEvaluate(p, gradient = true) {
  const result = macroEvaluate(fromPolar(p), gradient)
  const d = new Float64Array(p.length)
  const curvature = new Float64Array(p.length)
  for (const g of seq(groups.length)) {
    const r = p[2 * g],
      c = Math.cos(p[2 * g + 1]),
      s = Math.sin(p[2 * g + 1])
    const dx = result.d[2 * g],
      dy = result.d[2 * g + 1]
    d[2 * g] = c * dx + s * dy
    d[2 * g + 1] = r * (-s * dx + c * dy)
    // Diagonal Jacobian-based preconditioner, not an exact Hessian.
    curvature[2 * g] = result.curvature[2 * g] * c * c + result.curvature[2 * g + 1] * s * s
    curvature[2 * g + 1] = Math.max(
      0.1,
      r * r * (result.curvature[2 * g] * s * s + result.curvature[2 * g + 1] * c * c),
    )
  }
  return { ...result, d, curvature }
}
function polarRelax(start, steps) {
  let p = toPolar(start)
  let result = polarEvaluate(p)
  for (const iteration of seq(steps)) {
    let accepted = false
    let step = 1
    // Alternate radial, angular, and joint coordinate updates.
    const axes = iteration % 3
    for (const _attempt of seq(16)) {
      const trial = p.slice()
      for (const g of seq(groups.length)) {
        if (g === rootGroup) continue
        if (axes !== 1)
          trial[2 * g] -=
            step * Math.max(-300, Math.min(300, result.d[2 * g] / result.curvature[2 * g]))
        if (axes !== 0)
          trial[2 * g + 1] -=
            step *
            Math.max(-0.35, Math.min(0.35, result.d[2 * g + 1] / result.curvature[2 * g + 1]))
        if (trial[2 * g] < 0) {
          trial[2 * g] *= -1
          trial[2 * g + 1] += Math.PI
        }
      }
      trial[2 * rootGroup] = 0
      trial[2 * rootGroup + 1] = 0
      if (polarEvaluate(trial, false).cost < result.cost) {
        p = trial
        result = polarEvaluate(p)
        accepted = true
        break
      }
      step *= 0.5
    }
    // A radial-only or angular-only stall must not prevent trying the other coordinate.
    if (!accepted && axes === 2) break
  }
  return { z: fromPolar(p), cost: result.cost }
}
function macroRelax(start, steps) {
  if (polarMacro) return polarRelax(start, steps)
  let z = start.slice(),
    result = macroEvaluate(z)
  for (const _iteration of seq(steps)) {
    let step = 1,
      accepted = false
    for (const _attempt of seq(16)) {
      const trial = Float64Array.from(z, (v, i) => v - (step * result.d[i]) / result.curvature[i])
      trial[2 * rootGroup] = 0
      trial[2 * rootGroup + 1] = 0
      if (macroEvaluate(trial, false).cost < result.cost) {
        z = trial
        result = macroEvaluate(z)
        accepted = true
        break
      }
      step *= 0.5
    }
    if (!accepted) break
  }
  return { z, cost: result.cost }
}
const gradientRandom = randomSource(56219)
const macroGradientError = gradientCheck(
  macroEvaluate,
  Float64Array.from(seq(groups.length * 2), () => (gradientRandom() - 0.5) * 2000),
)
const polarGradientError = polarMacro
  ? gradientCheck(
      polarEvaluate,
      Float64Array.from(seq(groups.length * 2), (_, i) =>
        i % 2 === 0 ? 300 + gradientRandom() * 1400 : gradientRandom() * 6 - 3,
      ),
    )
  : null
const macroCandidates = []
for (const seed of seq(boundarySearch ? 0 : 4)) {
  const random = randomSource(713 + seed * 965)
  const z = new Float64Array(groups.length * 2)
  const order = shuffle(seq(groups.length), random)
  const cols = Math.ceil(Math.sqrt(groups.length))
  const strideX = Math.max(...groups.map((g) => g.w)) + 160
  const strideY = Math.max(...groups.map((g) => g.h)) + 160
  for (const [j, g] of order.entries()) {
    z[2 * g] = (j % cols) * strideX
    z[2 * g + 1] = Math.floor(j / cols) * strideY
  }
  const rx = z[2 * rootGroup],
    ry = z[2 * rootGroup + 1]
  for (const g of seq(groups.length)) {
    z[2 * g] -= rx
    z[2 * g + 1] -= ry
  }
  let state = macroRelax(z, 2200)
  let best = macroOverlap(state.z, 20) === 0 ? state : null
  for (const trialIndex of seq(100)) {
    const trial = state.z.slice()
    const a = Math.floor(random() * groups.length),
      b = Math.floor(random() * groups.length)
    if (a === rootGroup || b === rootGroup || a === b) continue
    if (polarMacro) {
      const pa = toPolar(trial)
      if (trialIndex % 3 === 0) {
        // Exchange angular positions while retaining each radius.
        const angle = pa[2 * a + 1]
        pa[2 * a + 1] = pa[2 * b + 1]
        pa[2 * b + 1] = angle
      } else if (trialIndex % 3 === 1) {
        // Move one group along its circular arc; do not rotate its rectangular frame.
        pa[2 * a + 1] += (random() - 0.5) * Math.PI * 2
      } else {
        // Radial relocation. Radius has no graph-hop or tier target.
        pa[2 * a] = Math.abs(pa[2 * a] + (random() - 0.5) * 1400)
      }
      trial.set(fromPolar(pa))
    } else if (trialIndex % 2 === 0) {
      const x = trial[2 * a],
        y = trial[2 * a + 1]
      trial[2 * a] = trial[2 * b]
      trial[2 * a + 1] = trial[2 * b + 1]
      trial[2 * b] = x
      trial[2 * b + 1] = y
    } else {
      const angle = random() * 2 * Math.PI,
        radius = 100 + random() * 600
      trial[2 * a] += Math.cos(angle) * radius
      trial[2 * a + 1] += Math.sin(angle) * radius
    }
    const candidate = macroRelax(trial, 100)
    if (
      candidate.cost < state.cost ||
      random() < Math.exp((state.cost - candidate.cost) / (state.cost * 0.002))
    ) {
      state = candidate
    }
    if (macroOverlap(candidate.z, 20) === 0 && (!best || candidate.cost < best.cost))
      best = candidate
  }
  if (best) macroCandidates.push({ ...best, seed })
  console.log('macro', seed, best?.cost, best ? macroOverlap(best.z) : 'no feasible candidate')
}
macroCandidates.sort((a, b) => a.cost - b.cost)
const macro = boundarySearch
  ? await optimizeBoundaryLayout({
      nodes,
      groups,
      links,
      rootGroup,
      upstreamRoot: upstreamRootId ? root : null,
      rootedInterior,
      warmStartPath: freeGroups
        ? 'tmp-test6-v7-rooted-interior-refined-report.json'
        : refineRooted
          ? 'tmp-test6-v7-rooted-interior-report.json'
          : null,
      enforceGroupOrder: !freeGroups,
      inputHash: createHash('sha256').update(inputText).digest('hex'),
    })
  : macroCandidates[0]
if (!macro) throw new Error('Macro search found no boundary-feasible arrangement')
const boxes = groups.map((g, i) => ({ ...g, x: macro.z[2 * i], y: macro.z[2 * i + 1] }))

// One explicit boundary terminal for EACH endpoint of EACH cross-group link.
const terminals = []
const terminalLookup = new Map()
const raySide = (A, B) => {
  const dx = B.x - A.x,
    dy = B.y - A.y
  const tx = Math.abs(dx) > 1e-9 ? A.w / 2 / Math.abs(dx) : Infinity
  const ty = Math.abs(dy) > 1e-9 ? A.h / 2 / Math.abs(dy) : Infinity
  const t = Math.min(tx, ty)
  return tx < ty
    ? { side: dx > 0 ? 'right' : 'left', ideal: A.y + t * dy }
    : { side: dy > 0 ? 'bottom' : 'top', ideal: A.x + t * dx }
}
for (const [li, l] of links.entries()) {
  if (l.ga === l.gb) continue
  for (const [g, other, node, end] of [
    [l.ga, l.gb, l.a, 'a'],
    [l.gb, l.ga, l.b, 'b'],
  ]) {
    const t = { li, g, other, node, end, ...raySide(boxes[g], boxes[other]) }
    terminals.push(t)
    terminalLookup.set(`${li}:${end}`, t)
  }
}
for (const [g, A] of boxes.entries())
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
    for (const j of seq(coords.length).slice(1))
      coords[j] = Math.max(coords[j], coords[j - 1] + spacing)
    if (coords[coords.length - 1] > high) {
      coords[coords.length - 1] = high
      for (const j of seq(coords.length - 1).reverse())
        coords[j] = Math.min(coords[j], coords[j + 1] - spacing)
    }
    for (const [j, t] of ts.entries()) {
      t.x = vertical ? A.x + ((side === 'right' ? 1 : -1) * A.w) / 2 : coords[j]
      t.y = vertical ? coords[j] : A.y + ((side === 'bottom' ? 1 : -1) * A.h) / 2
      t.nx = side === 'right' ? 1 : side === 'left' ? -1 : 0
      t.ny = side === 'bottom' ? 1 : side === 'top' ? -1 : 0
    }
  }
if (boundarySearch) {
  terminals.splice(0, terminals.length, ...macro.terminals.map((t) => ({ ...t })))
  terminalLookup.clear()
  for (const t of terminals) terminalLookup.set(`${t.li}:${t.end}`, t)
}
const boundarySnapshot = JSON.stringify(boxes.map((b) => [b.x, b.y, b.w, b.h]))
const positions = nodes.map(() => ({ x: 0, y: 0 }))
const internalReports = []
for (const [g, A] of boxes.entries()) {
  const members = A.members
  const localIndex = new Map(members.map((i, j) => [i, j]))
  const internal = links.filter((l) => l.ga === g && l.gb === g)
  const external = terminals.filter((t) => t.g === g)
  if (boundarySearch) {
    for (const i of members) positions[i] = { ...macro.positions[i] }
    internalReports.push({
      id: A.id,
      roots: A.hierarchy.roots,
      levels: macro.levels[g],
      oneRowPerDepth: true,
      internalLinks: internal.length,
      terminals: external.length,
    })
    continue
  }
  if (treeInterior) {
    const result = placeTree(nodes, A, internal, external)
    for (const [i, p] of result.positions) positions[i] = p
    internalReports.push({
      id: A.id,
      cost: result.cost,
      roots: A.hierarchy.roots,
      levels: result.levels,
      oneRowPerDepth: true,
      internalLinks: internal.length,
      terminals: external.length,
    })
    continue
  }
  const project = (start) => {
    const z = start.slice()
    for (const [j, i] of members.entries()) {
      const n = nodes[i]
      z[2 * j] = Math.max(
        A.x - A.w / 2 + 24 + n.w / 2,
        Math.min(A.x + A.w / 2 - 24 - n.w / 2, z[2 * j]),
      )
      z[2 * j + 1] = Math.max(
        A.y - A.h / 2 + 44 + n.h / 2,
        Math.min(A.y + A.h / 2 - 24 - n.h / 2, z[2 * j + 1]),
      )
    }
    return z
  }
  const overlaps = (z) => {
    let count = 0
    for (const [a, i] of members.entries())
      for (const b of seq(a)) {
        const j = members[b]
        if (
          Math.abs(z[2 * a] - z[2 * b]) < (nodes[i].w + nodes[j].w) / 2 &&
          Math.abs(z[2 * a + 1] - z[2 * b + 1]) < (nodes[i].h + nodes[j].h) / 2
        )
          count++
      }
    return count
  }
  const evaluate = (z, gradient = true) => {
    const d = new Float64Array(z.length),
      curvature = new Float64Array(z.length).fill(0.1)
    let cost = 0
    const add = (v, w, terms) => {
      cost += w * v * v
      if (gradient)
        for (const [i, a] of terms) {
          d[i] += 2 * w * v * a
          curvature[i] += 2 * w * a * a
        }
    }
    for (const l of internal) {
      const a = localIndex.get(l.a),
        b = localIndex.get(l.b)
      add(z[2 * a] - z[2 * b], 1, [
        [2 * a, 1],
        [2 * b, -1],
      ])
      add(z[2 * a + 1] - z[2 * b + 1], 1, [
        [2 * a + 1, 1],
        [2 * b + 1, -1],
      ])
    }
    for (const t of external) {
      const j = localIndex.get(t.node)
      add(z[2 * j] - t.x, 1, [[2 * j, 1]])
      add(z[2 * j + 1] - t.y, 1, [[2 * j + 1, 1]])
    }
    for (const [a, i] of members.entries())
      for (const b of seq(a)) {
        const j = members[b],
          dx = z[2 * a] - z[2 * b],
          dy = z[2 * a + 1] - z[2 * b + 1]
        const ox = (nodes[i].w + nodes[j].w) / 2 + 18 - Math.abs(dx)
        const oy = (nodes[i].h + nodes[j].h) / 2 + 18 - Math.abs(dy)
        if (ox <= 0 || oy <= 0) continue
        if (ox < oy)
          add(ox, 5000, [
            [2 * a, -(Math.sign(dx) || 1)],
            [2 * b, Math.sign(dx) || 1],
          ])
        else
          add(oy, 5000, [
            [2 * a + 1, -(Math.sign(dy) || 1)],
            [2 * b + 1, Math.sign(dy) || 1],
          ])
      }
    return { cost, d, curvature }
  }
  const gradientError = gradientCheck(
    evaluate,
    Float64Array.from(
      seq(members.length * 2),
      (_, j) => (j % 2 === 0 ? A.x : A.y) + (gradientRandom() - 0.5) * 300,
    ),
  )
  const relax = (initial, steps) => {
    let z = project(initial),
      r = evaluate(z),
      best = overlaps(z) === 0 ? { z: z.slice(), cost: r.cost } : null
    for (const _it of seq(steps)) {
      let step = 1,
        accepted = false
      for (const _attempt of seq(16)) {
        const candidate = project(
          Float64Array.from(z, (v, j) => v - (step * r.d[j]) / r.curvature[j]),
        )
        if (evaluate(candidate, false).cost < r.cost) {
          z = candidate
          r = evaluate(z)
          accepted = true
          break
        }
        step *= 0.5
      }
      if (!accepted) break
      if (overlaps(z) === 0 && (!best || r.cost < best.cost)) best = { z: z.slice(), cost: r.cost }
    }
    return best
  }
  let best = null
  const random = randomSource(924 + g * 137)
  for (const seed of seq(8)) {
    const order = shuffle(seq(members.length), random)
    const z = new Float64Array(members.length * 2)
    for (const [slot, j] of order.entries()) {
      z[2 * j] = A.x + ((slot % A.columns) - (A.columns - 1) / 2) * A.cellWidth
      z[2 * j + 1] = A.y + 10 + (Math.floor(slot / A.columns) - (A.rows - 1) / 2) * A.cellHeight
    }
    let candidate = relax(z, 700)
    for (const _trial of seq(members.length > 1 ? 12 : 0)) {
      if (!candidate) break
      const trial = candidate.z.slice()
      const a = Math.floor(random() * members.length),
        b = Math.floor(random() * members.length)
      const x = trial[2 * a],
        y = trial[2 * a + 1]
      trial[2 * a] = trial[2 * b]
      trial[2 * a + 1] = trial[2 * b + 1]
      trial[2 * b] = x
      trial[2 * b + 1] = y
      const swap = relax(trial, 100)
      if (swap && swap.cost < candidate.cost) candidate = swap
    }
    if (candidate && (!best || candidate.cost < best.cost)) best = { ...candidate, seed }
  }
  if (!best) throw new Error(`No feasible interior: ${A.label}`)
  for (const [j, i] of members.entries()) positions[i] = { x: best.z[2 * j], y: best.z[2 * j + 1] }
  internalReports.push({
    id: A.id,
    cost: best.cost,
    seed: best.seed,
    overlaps: overlaps(best.z),
    gradientError,
    internalLinks: internal.length,
    terminals: external.length,
  })
}
if (boundarySnapshot !== JSON.stringify(boxes.map((b) => [b.x, b.y, b.w, b.h])))
  throw new Error('Macro bounds moved during micro layout')
console.log('interiors complete', internalReports.length)

// Shared exterior router: boundary-aware mode also uses this for final candidate selection.
const routes = routeBoundaryConnections({ groups: boxes, nodes, links, positions, terminals })
const checks = {
  ...(rootedInterior
    ? {
        internalDependencyOrderViolations: links.filter(
          (l) =>
            l.ga === l.gb &&
            (groups[l.ga].hierarchy.rootDistances[l.a] -
              groups[l.gb].hierarchy.rootDistances[l.b]) *
              (positions[l.a].y - positions[l.b].y) <
              0,
        ).length,
      }
    : {}),
  ...(upstreamRootId
    ? {
        upstreamGroupOrderViolations: macro.diagnostics.upstream.violations,
        nodesAboveUpstream: positions.filter((p) => p.y < positions[root].y - 1e-6).length,
      }
    : {}),
  sameDepthDifferentY: 0,
  parentNotAboveChild: 0,
  nodeOverlaps: 0,
  groupOverlaps: macroOverlap(macro.z),
  outside: 0,
  terminalsOffBoundary: 0,
  exteriorFramePiercings: 0,
  missingTerminalRoutes: 0,
}
for (const [i, n] of nodes.entries()) {
  const p = positions[i],
    A = boxes[groupOf.get(i)]
  if (
    Math.abs(p.x - A.x) + n.w / 2 > A.w / 2 + 1e-6 ||
    Math.abs(p.y - A.y) + n.h / 2 > A.h / 2 + 1e-6
  )
    checks.outside++
  for (const j of seq(i))
    if (
      Math.abs(p.x - positions[j].x) < (n.w + nodes[j].w) / 2 - 1e-6 &&
      Math.abs(p.y - positions[j].y) < (n.h + nodes[j].h) / 2 - 1e-6
    )
      checks.nodeOverlaps++
}
for (const t of terminals) {
  const b = boxes[t.g]
  const dx = Math.abs(t.x - b.x),
    dy = Math.abs(t.y - b.y)
  if (
    !(
      (Math.abs(dx - b.w / 2) < 1e-6 && dy <= b.h / 2 + 1e-6) ||
      (Math.abs(dy - b.h / 2) < 1e-6 && dx <= b.w / 2 + 1e-6)
    )
  )
    checks.terminalsOffBoundary++
}
for (const r of routes.filter((r) => r.crossGroup)) {
  if (!r.exit || !r.entry) checks.missingTerminalRoutes++
  const exterior = r.points.slice(1, -1)
  for (const [i, p] of exterior.entries()) {
    if (i === 0) continue
    for (const b of boxes)
      if (
        segmentHits(exterior[i - 1], p, {
          left: b.x - b.w / 2,
          right: b.x + b.w / 2,
          top: b.y - b.h / 2,
          bottom: b.y + b.h / 2,
        })
      )
        checks.exteriorFramePiercings++
  }
}
if (Object.values(checks).some((v) => v !== 0)) throw new Error(JSON.stringify(checks))
if (treeInterior) {
  for (const b of boxes) {
    for (const row of b.hierarchy.levels) {
      if (row.some((i) => Math.abs(positions[i].y - positions[row[0]].y) > 1e-6))
        checks.sameDepthDifferentY++
    }
    for (const [child, parent] of Object.entries(b.hierarchy.parent)) {
      if (
        positions[parent].y + nodes[parent].h / 2 >=
        positions[Number(child)].y - nodes[Number(child)].h / 2
      )
        checks.parentNotAboveChild++
    }
  }
  if (checks.sameDepthDifferentY || checks.parentNotAboveChild)
    throw new Error(JSON.stringify(checks))
}

const escapeXml = (s) =>
  String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
const colors = ['#3e7c91', '#936844', '#5e7d57', '#846da6', '#397b74', '#977542', '#546dae']
const minX = Math.min(...boxes.map((b) => b.x - b.w / 2)) - 60,
  maxX = Math.max(...boxes.map((b) => b.x + b.w / 2)) + 60
const minY = Math.min(...boxes.map((b) => b.y - b.h / 2)) - 100,
  maxY = Math.max(...boxes.map((b) => b.y + b.h / 2)) + 60
function svg(mode) {
  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${[minX, minY, maxX - minX, maxY - minY].join(' ')}" font-family="Segoe UI, sans-serif">`,
    `<rect x="${minX}" y="${minY}" width="${maxX - minX}" height="${maxY - minY}" fill="#f7f9fc"/>`,
    `<text x="${minX + 20}" y="${minY + 35}" font-size="24" fill="#18334d">V7 · ${freeGroups ? 'Free group placement / Internet-rooted interiors' : rootedInterior ? 'Internet-rooted interiors / connection-aware placement' : upstreamRootId ? 'Internet upstream / boundary-aware placement' : boundarySearch ? 'boundary-aware dependency placement' : treeInterior ? 'polar groups / tree-sized interiors' : polarMacro ? 'polar subgraphs / Cartesian interiors' : 'boundary-first placement'} · 89 nodes / 160 links</text>`,
    '<text x="' +
      (minX + 20) +
      '" y="' +
      (minY + 60) +
      '" font-size="14" fill="#52667a">' +
      (mode === 'macro'
        ? 'Stage 1: dependency-based subgraphs + boundary terminals'
        : mode === 'only'
          ? treeInterior
            ? 'One row per depth; frame size derived from hierarchy'
            : 'Stage 2: fixed boundaries; internal node placement'
          : 'Stage 2: node → exit terminal → exterior path → entry terminal → node') +
      '</text>',
  ]
  if (polarMacro && mode === 'macro') {
    const radius = Math.max(...boxes.map((b) => Math.hypot(b.x, b.y)))
    for (const j of seq(Math.ceil(radius / 500)).slice(1)) {
      out.push(
        `<circle cx="0" cy="0" r="${j * 500}" fill="none" stroke="#95a9c0" stroke-opacity="0.25" stroke-dasharray="4 8"/>`,
      )
    }
    for (const j of seq(8)) {
      const angle = (j * Math.PI) / 4
      out.push(
        `<path d="M 0 0 L ${radius * Math.cos(angle)} ${radius * Math.sin(angle)}" fill="none" stroke="#95a9c0" stroke-opacity="0.15"/>`,
      )
    }
  }
  for (const [g, b] of boxes.entries()) {
    const c = colors[g % colors.length]
    out.push(
      '<rect x="' +
        (b.x - b.w / 2) +
        '" y="' +
        (b.y - b.h / 2) +
        '" width="' +
        b.w +
        '" height="' +
        b.h +
        '" fill="' +
        c +
        '" fill-opacity="0.04" stroke="' +
        c +
        '" stroke-opacity="0.65" stroke-width="1.5"/>',
    )
    out.push(
      `<text x="${b.x - b.w / 2 + 12}" y="${b.y - b.h / 2 + 22}" font-size="13" fill="${c}">${escapeXml(b.label)}</text>`,
    )
    if (mode === 'macro')
      out.push(
        `<text x="${b.x}" y="${b.y}" text-anchor="middle" fill="${c}" font-size="16">${b.members.length} nodes</text>`,
      )
  }
  if (mode !== 'only')
    for (const [li, r] of routes.entries()) {
      if (mode === 'macro' && !r.crossGroup) continue
      const points = mode === 'macro' ? r.points.slice(1, -1) : r.points
      const l = links[li],
        peer = l.role === 'floor-peer'
      out.push(
        '<path data-link="' +
          escapeXml(r.id) +
          '" d="' +
          points.map((p, i) => `${(i === 0 ? 'M ' : 'L ') + p.x} ${p.y}`).join(' ') +
          '" fill="none" stroke="' +
          (peer ? '#bf7134' : '#526d87') +
          '" stroke-opacity="' +
          (r.crossGroup ? 0.4 : 0.55) +
          '" stroke-width="' +
          (peer ? 1.6 : 1.1) +
          '" ' +
          (peer ? 'stroke-dasharray="5 4"' : '') +
          '/>',
      )
    }
  for (const t of terminals)
    out.push(
      '<circle cx="' +
        t.x +
        '" cy="' +
        t.y +
        '" r="3.1" fill="#fff" stroke="#b65c22" stroke-width="1.3"><title>' +
        escapeXml(links[t.li].id) +
        ' · ' +
        escapeXml(nodes[t.node].label) +
        ' · boundary terminal</title></circle>',
    )
  if (mode !== 'macro')
    for (const [i, n] of nodes.entries()) {
      const p = positions[i],
        ap = n.role === 'wireless-ap',
        poe = n.role === 'floor-poe-switch'
      out.push(
        '<g data-node="' +
          escapeXml(n.id) +
          '"><rect x="' +
          (p.x - n.w / 2) +
          '" y="' +
          (p.y - n.h / 2) +
          '" width="' +
          n.w +
          '" height="' +
          n.h +
          '" rx="' +
          (ap ? 15 : 7) +
          '" fill="' +
          (poe ? '#e1f1eb' : ap ? '#edf4ff' : '#fff') +
          '" stroke="' +
          (poe ? '#398779' : '#8a9cb1') +
          '"/>' +
          '<text x="' +
          p.x +
          '" y="' +
          (p.y - 1) +
          '" text-anchor="middle" font-size="12" fill="#19334e">' +
          escapeXml(n.label) +
          '</text>' +
          '<text x="' +
          p.x +
          '" y="' +
          (p.y + 14) +
          '" text-anchor="middle" font-size="9" fill="#697d91">' +
          escapeXml(n.role) +
          '</text></g>',
      )
    }
  return `${out.join('\n')}</svg>`
}
for (const [suffix, mode] of [
  ['', 'full'],
  ['-only', 'only'],
  ['-macro', 'macro'],
])
  await Bun.write(`${outputBase + suffix}.svg`, svg(mode))
if (treeInterior) {
  const detail = boxes.find((b) => b.id === 'test:area:hall-east')
  if (!detail) throw new Error('Missing detail group')
  const viewBox = [
    detail.x - detail.w / 2 - 24,
    detail.y - detail.h / 2 - 24,
    detail.w + 48,
    detail.h + 48,
  ].join(' ')
  await Bun.write(
    `${outputBase}-detail.svg`,
    svg('full').replace(/viewBox="[^"]+"/, `viewBox="${viewBox}"`),
  )
}
await Bun.write(
  `${outputBase}-report.json`,
  JSON.stringify(
    {
      version: 7,
      userSelectedUpstream: upstreamRootId,
      rootedInterior,
      enforceGroupOrder: !freeGroups,
      coordinateMode: upstreamRootId
        ? 'rooted-polar-macro-single-row-per-depth'
        : treeInterior
          ? 'polar-macro-single-row-per-depth'
          : polarMacro
            ? 'polar-macro-cartesian-micro'
            : 'cartesian-macro-cartesian-micro',
      inputPath,
      inputHash: createHash('sha256').update(inputText).digest('hex'),
      counts: {
        nodes: nodes.length,
        links: links.length,
        groups: groups.length,
        crossGroupLinks: links.filter((l) => l.ga !== l.gb).length,
        terminals: terminals.length,
        macroRelations: macroLinks.length,
      },
      macro: {
        boundarySearch: boundarySearch
          ? {
              ...macro.diagnostics,
              routedFinalMetrics: connectionMetrics(links, positions, terminals, routes),
              ...(rootedInterior
                ? {
                    interiorFinalMetrics: interiorMetrics(
                      nodes,
                      boxes,
                      links,
                      positions,
                      terminals,
                    ),
                  }
                : {}),
            }
          : null,
        polarGradientError: boundarySearch ? null : polarGradientError,
        gradientError: boundarySearch ? null : macroGradientError,
        selectedSeed: macro.seed,
        cost: macro.cost,
        candidates: macroCandidates.map(({ z: _z, ...c }) => c),
        anchorGroup: groups[rootGroup].id,
        boundariesFixedDuringInternalPlacement: true,
      },
      assumptions: [
        ...(upstreamRootId
          ? [
              freeGroups
                ? 'Group-to-group whole-frame upstream/downstream constraints are disabled. Only the Internet root group stays above other groups. Group ranks are not placement constraints; interior hierarchy remains unchanged.'
                : rootedInterior
                  ? 'The explicit root determines global undirected BFS distance. Both group order and interior hierarchy derive from it. All links are preserved; interior layers and content-derived frame sizes are recomputed.'
                  : 'The user-selected Internet root is upstream. Group order uses the minimum member hop distance from this root; connected groups of different depths are vertically ordered. Equal-depth groups have no fixed row. All links and existing interior hierarchy are preserved.',
            ]
          : []),
        ...(boundarySearch
          ? [
              'Macro candidate scoring recomputes actual-node-ray boundary terminals and interior sibling order. No node-pair-to-group-weight collapse in the score.',
              rootedInterior
                ? 'Equal baseline-relative weights for total crossings, internal node hits, internal collinear overlaps and squared complete connection length; not the same objective as earlier experiments.'
                : 'Equal baseline-relative weight for crossing pairs and squared complete connection length. Fast stage uses straight boundary spans; final ranking uses actual renderer routes. Score is not comparable to old centre-attraction objective.',
            ]
          : []),
        ...(treeInterior
          ? [
              'No frame size cap, no folding, no label/node scaling. Each depth occupies one horizontal row.',
              'Frame width/height are derived from all hierarchy rows plus drawing padding and title extent before macro placement.',
              rootedInterior
                ? 'Interior depths preserve global BFS distance order; unused depths within a group are compressed without folding. Same-distance links are peers; all lower-distance internal neighbors remain parents. This is display direction, not inferred traffic.'
                : 'Boundary-connected members are display roots; Internet overrides roots in its group. Undirected BFS defines interior depth, not physical traffic direction.',
            ]
          : []),
        treeInterior
          ? 'Macro search uses free radius/angle with unrotated frames sized from the unfolded hierarchy. No radial tiers or angular sectors.'
          : polarMacro
            ? 'Macro search uses radius/angle, radial moves, circular-arc moves and angle swaps; axis-aligned frames remain unrotated. Same objective and initial Cartesian positions as V7; different search moves, not an equal-budget solver benchmark.'
            : 'Macro search uses Cartesian coordinates.',
        boundarySearch
          ? 'All original undirected node-link records remain individual dependencies in the score, including parallel links.'
          : 'Node connections are undirected. Macro weights count unique connected node pairs.',
        treeInterior
          ? 'Group sizes come from the unfolded hierarchy geometry, not capacity estimates.'
          : 'Group sizes are capacity estimates from node count and label geometry, fixed before placement.',
        boundarySearch
          ? 'Each macro candidate alternates actual-node-ray boundary terminals and internal sibling orders; selected geometry is drawn unchanged.'
          : 'Macro positions first; ray-facing boundary terminals next; node interiors last.',
        rootedInterior
          ? 'Interior ordering scores internal wires and boundary stubs for crossings, unrelated node hits, collinear overlap and complete connection length. Boundary points are recomputed between order passes.'
          : 'Internal objective uses internal edge lengths plus distances to fixed external boundary terminals.',
        freeGroups
          ? 'Polar proposals keep the Internet root anchor and root-group top position, but do not project other groups onto a group dependency order. Frame separation still applies.'
          : upstreamRootId
            ? 'The explicit root supplies global upstream/downstream direction, not device roles. Polar proposals are projected onto this group order, with no fixed radii or level heights.'
            : treeInterior
              ? 'Only interior hierarchy sets vertical levels. No device-role tiers or global direction. Root group centre is a translation anchor.'
              : 'No role, global up/down, or hop-level placement. Root group centre is a translation anchor only.',
        'Each cross-group link retains two separate logical terminals, including parallel links.',
        boundarySearch
          ? 'Actual exterior-route crossings and lengths rank the finalist placements. Shared collinear segments are not penalized.'
          : 'Exterior visibility paths avoid frames, but crossings/shared segments are not optimized.',
        rootedInterior
          ? 'Interior segments remain straight. Node occlusion and overlap are evaluated, not guaranteed absent under the fixed one-row-per-depth geometry.'
          : 'Interior segments are straight; unrelated internal node occlusion is not optimized.',
        boundarySearch
          ? 'Derivative-free mixed search with infeasible frame overlap rejected; shortlist route scoring; no global optimum claim.'
          : 'Finite penalty searches, output feasibility validated. Not a global optimum.',
      ],
      checks,
      groups: boxes.map((b) => ({
        ...b,
        radius: Math.hypot(b.x, b.y),
        angleRadians: Math.atan2(b.y, b.x),
      })),
      nodes: nodes.map((n, i) => {
        const b = boxes[groupOf.get(i)]
        return {
          ...n,
          ...positions[i],
          localX: positions[i].x - b.x,
          localY: positions[i].y - b.y,
          ...(treeInterior
            ? {
                depth: b.hierarchy.depth[i],
                ...(rootedInterior
                  ? {
                      rootDistance: b.hierarchy.rootDistances[i],
                      parentNodes: b.hierarchy.parents[i].map((j) => nodes[j].id),
                    }
                  : {}),
                parentNode:
                  b.hierarchy.parent[i] === undefined ? null : nodes[b.hierarchy.parent[i]].id,
              }
            : {}),
        }
      }),
      terminals: terminals.map(({ waypoint: _w, ...t }) => t),
      links: links.map((l, i) => ({ ...l, ...routes[i] })),
      internalReports,
    },
    null,
    2,
  ),
)
console.log(
  'V7',
  JSON.stringify({
    checks,
    nodes: nodes.length,
    links: links.length,
    groups: groups.length,
    terminals: terminals.length,
  }),
)
