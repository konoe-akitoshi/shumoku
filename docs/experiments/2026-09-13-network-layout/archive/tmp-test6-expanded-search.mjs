import { createHash } from 'node:crypto'
import {
  boxes,
  evaluate,
  groupRelations,
  groupSpecs,
  N,
  nodeSpecs,
  relations,
  renderPlacement,
  root,
  sourceText,
  violations,
} from './tmp-test6-dependency-placement.mjs'

const baselinePath = 'tmp-test6-dependency-placement-report.json'
const baseline = await Bun.file(baselinePath).json()
const inputHash = createHash('sha256').update(sourceText).digest('hex')
if (baseline.inputHash !== inputHash) throw new Error('Input fixture differs from baseline')
const byId = new Map(baseline.positions.map((n) => [n.id, n]))
const start = Float64Array.from(
  nodeSpecs.flatMap((n) => {
    const p = byId.get(n.id)
    if (!p) throw new Error('Missing baseline node')
    return [p.x, p.y]
  }),
)
const baselineCost = evaluate(start, false).cost
if (Math.abs(baselineCost - baseline.candidates[0].cost) > 0.0001)
  throw new Error('Objective changed')
const sequence = (n) => Array.from({ length: n }, (_, i) => i)
const budget = 40000
let rngState = 82653
const random = () => {
  rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0
  return rngState / 4294967296
}
const groupNeighbors = groupSpecs.map(() => new Set())
for (const { a, b } of groupRelations) {
  groupNeighbors[a].add(b)
  groupNeighbors[b].add(a)
}
const subsetMap = new Map()
const insertSubset = (members) => {
  const ids = [...new Set(members)].filter((i) => i !== root).sort((a, b) => a - b)
  if (ids.length) subsetMap.set(ids.join(','), ids)
}
insertSubset(sequence(N))
for (const g of groupSpecs) insertSubset(g.members)
for (const [g] of groupSpecs.entries()) {
  let visited = new Set([g])
  for (const _radius of [1, 2]) {
    visited = new Set([...visited, ...[...visited].flatMap((h) => [...groupNeighbors[h]])])
    insertSubset([...visited].flatMap((h) => groupSpecs[h].members))
  }
}
const subsets = [...subsetMap.values()]
const movableGroups = groupSpecs.filter((g) => !g.members.includes(root))
function metrics(z) {
  const bs = boxes(z)
  const minX = Math.min(...bs.map((b) => b.x - b.hw)),
    maxX = Math.max(...bs.map((b) => b.x + b.hw))
  const minY = Math.min(...bs.map((b) => b.y - b.hh)),
    maxY = Math.max(...bs.map((b) => b.y + b.hh))
  const rootLinks = relations
    .filter((e) => e.a === root || e.b === root)
    .map((e) => ({
      a: nodeSpecs[e.a].id,
      b: nodeSpecs[e.b].id,
      length: Math.hypot(z[2 * e.a] - z[2 * e.b], z[2 * e.a + 1] - z[2 * e.b + 1]),
    }))
  const wanIndex = groupSpecs.findIndex((g) => g.members.includes(root))
  const wan = bs[wanIndex]
  return {
    cost: evaluate(z, false).cost,
    losses: evaluate(z, false).losses,
    checks: violations(z),
    width: maxX - minX,
    height: maxY - minY,
    area: (maxX - minX) * (maxY - minY),
    wanWidth: wan.hw * 2,
    wanHeight: wan.hh * 2,
    wanArea: wan.hw * wan.hh * 4,
    rootLinks,
  }
}
function solver(mode) {
  let evaluations = 0
  const stats = {}
  const trace = []
  let feasibleBest = start.slice(),
    bestCost = baselineCost
  const started = Date.now()
  const test = (z, gradient = false) => {
    evaluations++
    return evaluate(z, gradient)
  }
  const record = (state, kind) => {
    const checks = violations(state.z)
    if (
      checks.nodeOverlaps === 0 &&
      checks.groupOverlaps === 0 &&
      checks.anchorError === 0 &&
      state.cost < bestCost
    ) {
      feasibleBest = state.z.slice()
      bestCost = state.cost
    }
    const s = stats[kind] ?? { attempts: 0, accepted: 0 }
    stats[kind] = s
    return s
  }
  const local = (state, steps) => {
    let current = state
    for (const _iteration of sequence(steps)) {
      if (evaluations >= budget) break
      const r = test(current.z, true)
      let step = 1,
        accepted = false
      for (const _attempt of sequence(20)) {
        if (evaluations >= budget) break
        const z = Float64Array.from(current.z, (v, i) => v - (step * r.d[i]) / r.curvature[i])
        z[2 * root] = 0
        z[2 * root + 1] = 0
        const cost = test(z).cost
        if (cost < current.cost) {
          current = { z, cost }
          accepted = true
          break
        }
        step *= 0.5
      }
      if (!accepted) break
    }
    record(current, 'local')
    return current
  }
  let state = { z: start.slice(), cost: baselineCost }
  if (mode === 'local') {
    while (evaluations < budget) {
      const prev = evaluations
      state = local(state, 500)
      if (evaluations === prev) break
      trace.push({ evaluations, cost: state.cost, bestFeasible: bestCost })
      if (trace.length % 8 === 0) console.log(mode, evaluations, Math.round(bestCost))
    }
  } else {
    for (const epoch of sequence(1000)) {
      if (evaluations >= budget) break
      // Rigid group/connected-region translations: directions are summed gradients,
      // not independent diagonal node steps. Test large endpoint moves directly.
      for (const members of subsets) {
        if (evaluations >= budget) break
        const r = test(state.z, true)
        const gx = members.reduce((s, i) => s + r.d[2 * i], 0)
        const gy = members.reduce((s, i) => s + r.d[2 * i + 1], 0)
        const norm = Math.hypot(gx, gy)
        if (norm < 0.001) continue
        const stat = record(state, 'block-translation')
        stat.attempts++
        let proposal = state
        for (const length of [32, 128, 512, 1024]) {
          if (evaluations >= budget) break
          const z = state.z.slice()
          for (const i of members) {
            z[2 * i] -= (length * gx) / norm
            z[2 * i + 1] -= (length * gy) / norm
          }
          const cost = test(z).cost
          if (cost < proposal.cost) proposal = { z, cost }
        }
        if (proposal !== state) {
          state = proposal
          stat.accepted++
          record(state, 'block-translation')
        }
      }
      state = local(state, 100)
      // Jump proposals may initially be worse; relax them before acceptance.
      // Uphill relaxed candidates can be accepted temporarily; final output is best feasible.
      for (const attempt of sequence(12)) {
        if (evaluations >= budget) break
        const kind =
          attempt % 3 === 0
            ? 'group-swap'
            : attempt % 3 === 1
              ? 'group-relocation'
              : 'subset-rotation'
        const stat = record(state, kind)
        stat.attempts++
        const z = state.z.slice()
        const A = movableGroups[Math.floor(random() * movableGroups.length)]
        if (!A) continue
        const cx = A.members.reduce((s, i) => s + z[2 * i], 0) / A.members.length
        const cy = A.members.reduce((s, i) => s + z[2 * i + 1], 0) / A.members.length
        if (kind === 'group-swap') {
          const B = movableGroups[Math.floor(random() * movableGroups.length)]
          if (!B || A === B) continue
          const bx = B.members.reduce((s, i) => s + z[2 * i], 0) / B.members.length
          const by = B.members.reduce((s, i) => s + z[2 * i + 1], 0) / B.members.length
          for (const i of A.members) {
            z[2 * i] += bx - cx
            z[2 * i + 1] += by - cy
          }
          for (const i of B.members) {
            z[2 * i] += cx - bx
            z[2 * i + 1] += cy - by
          }
        } else if (kind === 'group-relocation') {
          const angle = random() * 2 * Math.PI,
            radius = 100 + random() * 700
          for (const i of A.members) {
            z[2 * i] += Math.cos(angle) * radius
            z[2 * i + 1] += Math.sin(angle) * radius
          }
        } else {
          const angle = (random() - 0.5) * 2 * Math.PI
          for (const i of A.members) {
            const dx = z[2 * i] - cx,
              dy = z[2 * i + 1] - cy
            z[2 * i] = cx + dx * Math.cos(angle) - dy * Math.sin(angle)
            z[2 * i + 1] = cy + dx * Math.sin(angle) + dy * Math.cos(angle)
          }
        }
        const trial = local({ z, cost: test(z).cost }, 35)
        const delta = trial.cost - state.cost
        const temperature = baselineCost * 0.008 * Math.max(0.02, 1 - evaluations / budget)
        if (delta < 0 || random() < Math.exp(-delta / temperature)) {
          state = trial
          stat.accepted++
          if (delta > 0) stat.uphillAccepted = (stat.uphillAccepted ?? 0) + 1
          record(state, kind)
        }
      }
      if (epoch % 3 === 2) state = { z: feasibleBest.slice(), cost: bestCost }
      trace.push({ evaluations, cost: state.cost, bestFeasible: bestCost })
      console.log(mode, epoch, evaluations, Math.round(bestCost))
    }
  }
  return {
    z: feasibleBest,
    cost: bestCost,
    evaluations,
    elapsedMs: Date.now() - started,
    stats,
    trace,
  }
}
const results = []
for (const mode of ['local', 'expanded']) {
  const result = solver(mode)
  const name = `tmp-test6-search-${mode}`
  await Bun.write(
    `${name}.svg`,
    renderPlacement(
      result.z,
      true,
      mode === 'local' ? 'Continued local search' : 'Expanded search; unchanged objective',
    ),
  )
  await Bun.write(
    `${name}-only.svg`,
    renderPlacement(
      result.z,
      false,
      mode === 'local' ? 'Continued local search' : 'Expanded search; unchanged objective',
    ),
  )
  const report = {
    mode,
    ...result,
    z: undefined,
    metrics: metrics(result.z),
    positions: nodeSpecs.map((n, i) => ({ ...n, x: result.z[2 * i], y: result.z[2 * i + 1] })),
  }
  results.push(report)
  console.log(
    'RESULT',
    JSON.stringify({ mode, evaluations: result.evaluations, metrics: report.metrics }),
  )
}
await Bun.write(
  'tmp-test6-search-comparison-report.json',
  JSON.stringify(
    {
      inputHash,
      baselinePath,
      objectiveVerifiedUnchanged: true,
      budgetPerMethod: budget,
      subsetCount: subsets.length,
      baseline: metrics(start),
      results,
      note: 'Same selected baseline, same objective and same evaluation-call budget. Local and expanded both retain best geometry-feasible state. Wall times differ. Single deterministic trial, not a global optimum claim.',
    },
    null,
    2,
  ),
)
