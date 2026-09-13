import { createCoupledModel, scoreGeometry } from './tmp-test6-v8-coupled-geometry.mjs'

const baseline = await Bun.file('tmp-test6-v8-distributed-ports-report.json').json()
const input = await Bun.file('tmp-test6-complete-upstream-to-ap.json').json()
const names = ['checkpoint', 'structure-7', 'structure-19', 'relaxed-7', 'relaxed-19', 'continued']
const runs = []
for (const start of names) {
  const file = Bun.file(`tmp-test6-v8-coupled-search-${start}-report.json`)
  if (!(await file.exists())) continue
  const r = await file.json()
  const model = createCoupledModel(input, r, r.avoidance.options)
  const scored = scoreGeometry(model, r.nodes, r.links, r.avoidance.after)
  if (scored.score !== r.coupledSearch.score)
    throw new Error(`Score does not match rendered geometry: ${start}`)
  runs.push({
    start,
    iterations: r.coupledSearch.iterations,
    score: scored.score,
    terms: scored.terms,
    metrics: r.avoidance.after,
    statistics: r.coupledSearch.statistics,
    report: `tmp-test6-v8-coupled-search-${start}-report.json`,
  })
}
runs.sort((a, b) => a.score - b.score)
const winner = await Bun.file(runs[0].report).json()
const endpointChanges = (old, next) => {
  const lookup = new Map(old.map((p) => [`${p.li}:${p.end}`, p]))
  return next.filter((p) => lookup.get(`${p.li}:${p.end}`).side !== p.side).length
}
const pairReversals = (indices, before, after, axis) =>
  indices.reduce(
    (sum, i, k) =>
      sum +
      indices.slice(k + 1).filter((j) => {
        const a = before[i][axis] - before[j][axis],
          b = after[i][axis] - after[j][axis]
        return Math.abs(a) > 1e-6 && Math.abs(b) > 1e-6 && Math.sign(a) !== Math.sign(b)
      }).length,
    0,
  )
const audit = {
  winner: runs[0].start,
  runs,
  changes: {
    nodeSides: endpointChanges(baseline.nodePorts, winner.nodePorts),
    boundarySides: endpointChanges(baseline.terminals, winner.terminals),
    nodeXPairReversals: baseline.groups.reduce(
      (s, g) => s + pairReversals(g.members, baseline.nodes, winner.nodes, 'x'),
      0,
    ),
    nodeYPairReversals: baseline.groups.reduce(
      (s, g) => s + pairReversals(g.members, baseline.nodes, winner.nodes, 'y'),
      0,
    ),
    groupXPairReversals: pairReversals(
      baseline.groups.map((_g, i) => i),
      baseline.groups,
      winner.groups,
      'x',
    ),
    groupYPairReversals: pairReversals(
      baseline.groups.map((_g, i) => i),
      baseline.groups,
      winner.groups,
      'y',
    ),
  },
  baselineMetrics: baseline.avoidance.after,
  baselineScore: winner.coupledSearch.baselineScore,
  limits: [
    'Finite heuristic proposals; different starts still produce different quality',
    'Four rectangular sides and centered equally-spaced node ports retained from requested display policy',
    'Visibility routes use obstacle corners, not arbitrary free-space bend points',
    'Nonoverlap repair uses a current least-translation heuristic; infeasible/nonconvergent candidates are rejected',
    'Area ratio, wire clearance, title padding and score weights remain explicit configurable policies',
  ],
}
await Bun.write('tmp-test6-v8-coupled-search-audit.json', JSON.stringify(audit, null, 2))
await Bun.write('tmp-test6-v8-coupled-search-runs.json', JSON.stringify({ results: runs }, null, 2))
await Bun.write('tmp-test6-v8-coupled-search-report.json', JSON.stringify(winner, null, 2))
console.log(
  JSON.stringify({
    winner: audit.winner,
    changes: audit.changes,
    runs: runs.map((r) => ({
      start: r.start,
      iterations: r.iterations,
      score: r.score,
      crossings: r.metrics.crossings,
      length: r.metrics.length,
      overlap: r.metrics.overlapLength,
    })),
  }),
)
