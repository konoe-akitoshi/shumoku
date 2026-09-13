import { expect, test } from 'bun:test'
import { segmentHits } from './tmp-test6-v7-boundary-routing.mjs'
import { endpointSide, measureConnectionHaloSpacing } from './tmp-test6-v8-connection-halo.mjs'
import {
  assignSides,
  blankState,
  createCoupledModel,
  evaluateCoupled,
  overlapCorrection,
  placeBoundarySlots,
  rectangle,
  scoreGeometry,
  sides,
  visibilityPath,
} from './tmp-test6-v8-coupled-geometry.mjs'
import { relaxedStructuralSeed, structuralSeed } from './tmp-test6-v8-coupled-search.mjs'
import { measureWires } from './tmp-test6-v8-dynamic-avoidance.mjs'
import { measureLineAvoidance } from './tmp-test6-v8-line-avoidance.mjs'

const small = () => {
  const input = {
    nodes: ['r', 'a', 'b'].map((id) => ({ id, label: id, parent: 'g' })),
    subgraphs: [{ id: 'g', label: 'g' }],
    links: ['a', 'b'].map((id) => ({ id, from: { node: 'r' }, to: { node: id } })),
  }
  const display = { nodes: input.nodes.map((n) => ({ ...n, w: 80, h: 40 })) }
  return createCoupledModel(input, display, {
    rootId: 'r',
    anchor: { x: 0, y: 0 },
    insets: { left: 20, right: 20, top: 40, bottom: 20 },
    areaRatio: 0.15,
    nodeStroke: 1,
    frameStroke: 1.5,
    wireWidth: 1.6,
    clearance: 1.3,
    wireClearanceScale: 1.5,
    maxRepairPasses: 512,
    weights: { length: 1, crossings: 1, overlap: 1, dependency: 1 },
  })
}
const same = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-6

test('nonoverlap repair has no retained side or ordering; all four separation directions are available', () => {
  const b = { x: 0, y: 0, w: 100, h: 100 }
  for (const [x, y] of [
    [90, 0],
    [-90, 0],
    [0, 90],
    [0, -90],
  ]) {
    const d = overlapCorrection({ ...b, x, y }, b)
    expect(Math.sign(d.x)).toBe(Math.sign(x))
    expect(Math.sign(d.y)).toBe(Math.sign(y))
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(10, 8)
  }
})

test('all node sides and either boundary order can be selected independently of initial geometry', () => {
  const box = { x: 0, y: 0, w: 100, h: 80 },
    rs = [
      { key: 'a', toward: { x: 200, y: -5 } },
      { key: 'b', toward: { x: 200, y: 5 } },
    ]
  for (const side of sides) {
    const a = assignSides(box, rs, 5.5, { a: side, b: side }, { a: -1, b: 1 }, true)
    const b = assignSides(box, rs, 5.5, { a: side, b: side }, { a: 1, b: -1 }, true)
    expect(a.map((p) => p.key)).toEqual(['a', 'b'])
    expect(b.map((p) => p.key)).toEqual(['b', 'a'])
    const ports = placeBoundarySlots(box, b, 5.5)
    for (const p of ports) expect(endpointSide(box, p)).toBe(side)
    expect(Math.hypot(ports[0].x - ports[1].x, ports[0].y - ports[1].y)).toBeGreaterThanOrEqual(
      5.5 - 1e-6,
    )
  }
})

test('routing considers both obstacle sides and existing wire cost can change its choice', () => {
  const a = { x: -5, y: 0 },
    b = { x: 5, y: 0 },
    obstacles = [{ left: -1, right: 1, top: -1, bottom: 1 }]
  const first = visibilityPath(a, b, obstacles)
  const next = visibilityPath(
    a,
    b,
    obstacles,
    null,
    [
      {
        points: [
          { x: 0, y: -2 },
          { x: 0, y: 0 },
        ],
      },
    ],
    10,
    { crossings: 1, overlap: 1 },
  )
  expect(first.some((p) => p.y < 0)).toBe(true)
  expect(next.some((p) => p.y > 0)).toBe(true)
  for (const ps of [first, next])
    for (const [i, p] of ps.entries())
      if (i) expect(segmentHits(ps[i - 1], p, obstacles[0])).toBe(false)
})

test('siblings may exchange X order, move above the root, and expand their frame without a cap', () => {
  const model = small()
  const a = evaluateCoupled(
    model,
    blankState(
      model.nodes.map((n) =>
        n.id === 'r' ? { x: 0, y: 0 } : { x: n.id === 'a' ? -120 : 120, y: 120 },
      ),
    ),
  )
  const b = evaluateCoupled(
    model,
    blankState(
      model.nodes.map((n) =>
        n.id === 'r' ? { x: 0, y: 0 } : { x: n.id === 'a' ? 500 : -500, y: -120 },
      ),
    ),
  )
  expect(a).not.toBeNull()
  expect(b).not.toBeNull()
  const node = (r, id) => r.nodes.find((n) => n.id === id)
  expect(node(a, 'a').x).toBeLessThan(node(a, 'b').x)
  expect(node(b, 'a').x).toBeGreaterThan(node(b, 'b').x)
  expect(node(b, 'a').y).toBeLessThan(node(b, 'r').y)
  expect(b.groups[0].w).toBeGreaterThan(a.groups[0].w)
  expect(node(b, 'r')).toMatchObject({ x: 0, y: 0 })
})

test('structural seeds do not consume old coordinates, rows, roles, link paths or port assignments', () => {
  const a = small(),
    b = small()
  b.nodes = b.nodes.map((n) => ({ ...n, x: 99999, y: -88888, role: 'arbitrary', depth: 90 }))
  b.groups = b.groups.map((g) => ({ ...g, x: 10000, y: 20000, hierarchy: { levels: [] } }))
  b.links = b.links.map((l) => ({ ...l, points: [{ x: 100, y: 200 }] }))
  expect(structuralSeed(a, 7)).toEqual(structuralSeed(b, 7))
  expect(structuralSeed(a, 7)).not.toEqual(structuralSeed(a, 19))
  expect(relaxedStructuralSeed(a, 7)).toEqual(relaxedStructuralSeed(b, 7))
})

test('boundary points can slide along the same edge without moving nodes or changing side', () => {
  const box = { x: 0, y: 0, w: 200, h: 100 }
  const request = [{ key: 'a', side: 'bottom', toward: { x: 0, y: 200 } }]
  const a = placeBoundarySlots(box, request, 5.5)
  const b = placeBoundarySlots(box, request, 5.5, { a: 40 })
  expect(b[0].x - a[0].x).toBe(40)
  expect(b[0].y).toBe(a[0].y)
})

test('coupled artifact replays exactly and scores final rendered routes, retaining the complete input', async () => {
  const r = await Bun.file('tmp-test6-v8-coupled-search-report.json').json(),
    input = await Bun.file('tmp-test6-complete-upstream-to-ap.json').json()
  const model = createCoupledModel(input, r, r.avoidance.options),
    original = structuredClone(r.coupledSearch.state)
  const replay = evaluateCoupled(model, r.coupledSearch.state)
  expect(r.coupledSearch.state).toEqual(original)
  expect(replay).not.toBeNull()
  expect(replay.metrics).toEqual(r.avoidance.after)
  expect(replay.score).toBe(r.coupledSearch.score)
  expect(scoreGeometry(model, r.nodes, r.links, r.avoidance.after).score).toBe(
    r.coupledSearch.score,
  )
  expect(r.nodes).toHaveLength(89)
  expect(r.links).toHaveLength(160)
  expect(r.groups).toHaveLength(31)
  expect(r.terminals).toHaveLength(196)
  expect(r.links.map((l) => [l.id, r.nodes[l.a].id, r.nodes[l.b].id])).toEqual(
    input.links.map((l) => [l.id, l.from.node, l.to.node]),
  )
  for (const key of [
    'hits',
    'nearPairs',
    'nodeHaloPairs',
    'groupHaloPairs',
    'nodeContactPairs',
    'groupContactPairs',
  ])
    expect(r.avoidance.after[key]).toBe(0)
  expect(r.nodes[model.root]).toMatchObject(model.options.anchor)
}, 20000)

test('final physical geometry, port spacing and boundary traversal agree with the rendered polylines', async () => {
  const r = await Bun.file('tmp-test6-v8-coupled-search-report.json').json()
  for (const [kind, ps] of [
    ['nodes', r.nodePorts],
    ['groups', r.terminals],
  ])
    for (const p of ps) {
      const owner = kind === 'nodes' ? p.node : p.g,
        rect = rectangle(r[kind][owner])
      expect(p.x).toBeGreaterThanOrEqual(rect.left - 1e-6)
      expect(p.x).toBeLessThanOrEqual(rect.right + 1e-6)
      expect(p.y).toBeGreaterThanOrEqual(rect.top - 1e-6)
      expect(p.y).toBeLessThanOrEqual(rect.bottom + 1e-6)
      for (const q of ps)
        if (q.key !== p.key && (kind === 'nodes' ? q.node : q.g) === owner && q.side === p.side)
          expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThanOrEqual(
            r.avoidance.options.pitch - 1e-6,
          )
    }
  for (const p of r.nodePorts) {
    const l = r.links[p.li],
      n = r.nodes[p.node]
    expect(same(p, p.end === 'a' ? l.points[0] : l.points.at(-1))).toBe(true)
    expect(endpointSide(n, p)).toBe(p.side)
  }
  for (const t of r.terminals) expect(endpointSide(r.groups[t.g], t)).toBe(t.side)
  for (const l of r.links) {
    for (const [i, p] of l.points.entries())
      if (i)
        for (const n of r.nodes) expect(segmentHits(l.points[i - 1], p, rectangle(n))).toBe(false)
    if (l.crossGroup) {
      const first = l.points.findIndex((p) => same(p, l.exit)),
        last = l.points.findIndex((p) => same(p, l.entry))
      expect(first).toBeGreaterThan(0)
      expect(last).toBeGreaterThan(first)
      const outside = l.points.slice(first, last + 1)
      for (const [i, p] of outside.entries())
        if (i)
          for (const g of r.groups) expect(segmentHits(outside[i - 1], p, rectangle(g))).toBe(false)
    }
  }
})

test('every saved run has measurements recomputed from its actual final geometry', async () => {
  const audit = await Bun.file('tmp-test6-v8-coupled-search-audit.json').json()
  for (const run of audit.runs) {
    const r = await Bun.file(run.report).json(),
      o = r.avoidance.options
    const metrics = {
      ...measureLineAvoidance(r.nodes, r.links, o.clearance),
      ...measureWires(r.links),
      ...measureConnectionHaloSpacing(
        r.nodes,
        r.groups,
        r.links,
        r.terminals,
        o.nodeStroke,
        o.frameStroke,
        o.areaRatio,
      ),
    }
    expect(metrics).toEqual(r.avoidance.after)
    expect(metrics.hits + metrics.nearPairs + metrics.nodeHaloPairs + metrics.groupHaloPairs).toBe(
      0,
    )
  }
})
