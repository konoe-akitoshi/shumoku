import {
  blankState,
  createCoupledModel,
  evaluateCoupled,
  scoreGeometry,
} from './tmp-test6-v8-coupled-geometry.mjs'
import {
  optimizeCoupled,
  relaxedStructuralSeed,
  structuralSeed,
} from './tmp-test6-v8-coupled-search.mjs'

const baseline = await Bun.file('tmp-test6-v8-distributed-ports-report.json').json()
const input = await Bun.file('tmp-test6-complete-upstream-to-ap.json').json()
const sourceOptions = baseline.avoidance.options
const options = {
  rootId: 'test:internet',
  anchor: {
    x: baseline.nodes.find((n) => n.id === 'test:internet').x,
    y: baseline.nodes.find((n) => n.id === 'test:internet').y,
  },
  insets: sourceOptions.insets[0],
  nodeStroke: sourceOptions.nodeStroke,
  frameStroke: sourceOptions.frameStroke,
  wireWidth: sourceOptions.wireWidth,
  clearance: sourceOptions.clearance,
  areaRatio: sourceOptions.areaRatio,
  wireClearanceScale: sourceOptions.wireClearanceScale,
  maxRepairPasses: 512,
  weights: { length: 1, crossings: 1, overlap: 1, dependency: 1 },
}
const model = createCoupledModel(input, baseline, options)
const iterations = Number(
  process.argv.find((a) => a.startsWith('--iterations='))?.split('=')[1] ?? 400,
)
if (!Number.isInteger(iterations) || iterations < 1)
  throw new Error('Expected positive iteration count')
const selected = process.argv.find((a) => a.startsWith('--start='))?.split('=')[1]
const continuation =
  selected === 'continued'
    ? await Bun.file('tmp-test6-v8-coupled-search-checkpoint-report.json').json()
    : null
const starts = [
  {
    name: 'checkpoint',
    seed: 101,
    initial: blankState(model.nodes.map((n) => baseline.nodes.find((p) => p.id === n.id))),
  },
  { name: 'structure-7', seed: 7, initial: structuralSeed(model, 7) },
  { name: 'structure-19', seed: 19, initial: structuralSeed(model, 19) },
  { name: 'relaxed-7', seed: 7, initial: relaxedStructuralSeed(model, 7) },
  { name: 'relaxed-19', seed: 19, initial: relaxedStructuralSeed(model, 19) },
  ...(continuation
    ? [{ name: 'continued', seed: 303, initial: continuation.coupledSearch.state }]
    : []),
].filter((s) => !selected || s.name === selected)
if (!starts.length) throw new Error('Unknown start')
const results = []
for (const start of starts) {
  console.log(JSON.stringify({ start: start.name, phase: 'begin' }))
  const result = await optimizeCoupled(model, start.initial, {
    iterations,
    seed: start.seed,
    onProgress: (p) => console.log(JSON.stringify({ start: start.name, ...p })),
  })
  const output = `tmp-test6-v8-coupled-search-${start.name}`
  const baselineOrder = baseline.nodes.map((n) => model.nodes.findIndex((p) => p.id === n.id))
  if (!baselineOrder.every((v, i) => v === i))
    throw new Error('Display node order differs from structural input order')
  const oldScore = scoreGeometry(model, baseline.nodes, baseline.links, baseline.avoidance.after)
  const report = {
    version: 8,
    inputPath: baseline.inputPath,
    inputHash: baseline.inputHash,
    counts: baseline.counts,
    placementSource: 'tmp-test6-complete-upstream-to-ap.json',
    comparisonSource: 'tmp-test6-v8-distributed-ports-report.json',
    nodes: result.nodes.map((n, i) => ({
      ...n,
      localX: n.x - result.groups[model.groupOf[i]].x,
      localY: n.y - result.groups[model.groupOf[i]].y,
    })),
    groups: result.groups,
    links: result.links,
    terminals: result.terminals,
    nodePorts: result.nodePorts,
    coupledSearch: {
      start: start.name,
      state: result.state,
      score: result.score,
      terms: result.terms,
      baselineScore: oldScore,
      ...result.search,
    },
    avoidance: {
      model:
        'Candidate-level joint feedback: independent node and group XY, side/order choices, dynamic frames and directional bands, current boundary slots, visibility routing and route alternatives. Every accepted candidate is measured after final rerouting. No original-coordinate attraction, retained depth/row/order constraints, frame size caps or role tiers. Finite heuristic search; not a global-optimality claim.',
      options: model.options,
      before: baseline.avoidance.after,
      after: result.metrics,
      trace: result.search.trace,
      evaluations: iterations,
      moved: result.nodes.flatMap((n, i) => {
        const b = baseline.nodes[i],
          dx = n.x - b.x,
          dy = n.y - b.y
        return Math.hypot(dx, dy) > 1e-6 ? [{ id: n.id, dx, dy, distance: Math.hypot(dx, dy) }] : []
      }),
    },
  }
  await Bun.write(`${output}-report.json`, JSON.stringify(report, null, 2))
  results.push({
    iterations,
    start: start.name,
    score: result.score,
    metrics: result.metrics,
    report: `${output}-report.json`,
  })
  // A saved state must describe the actual scored final geometry, not a pre-route state.
  const replay = evaluateCoupled(model, result.state)
  console.log(
    JSON.stringify({
      start: start.name,
      phase: 'complete',
      score: result.score,
      replayScore: replay?.score,
      metrics: result.metrics,
    }),
  )
}
// Preserve completed runs from earlier invocations, so a single-start trial
// cannot silently replace a better result from another starting point.
const previousRuns = Bun.file('tmp-test6-v8-coupled-search-runs.json')
if (await previousRuns.exists())
  for (const old of (await previousRuns.json()).results)
    if (!results.some((r) => r.start === old.start)) results.push(old)
results.sort((a, b) => a.score - b.score)
await Bun.write(
  'tmp-test6-v8-coupled-search-runs.json',
  JSON.stringify({ iterations, results }, null, 2),
)
const winner = await Bun.file(results[0].report).json()
await Bun.write('tmp-test6-v8-coupled-search-report.json', JSON.stringify(winner, null, 2))
console.log(JSON.stringify({ winner: results[0].start, results }))
