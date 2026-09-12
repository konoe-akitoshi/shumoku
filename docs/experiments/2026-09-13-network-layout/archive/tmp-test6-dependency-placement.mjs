import { createHash } from 'node:crypto'

// Standalone dependency experiment. Original fixture is read-only.
const inputPath = 'tmp-test6-complete-upstream-to-ap.json'
const sourceText = await Bun.file(inputPath).text()
const graph = JSON.parse(sourceText)
const outputBase = 'tmp-test6-dependency-placement'
const sequence = (n) => Array.from({ length: n }, (_, i) => i)
const nodeSpecs = [...graph.nodes]
  .sort((a, b) => a.id.localeCompare(b.id))
  .map((n) => ({
    id: n.id,
    label: n.label,
    role: n.metadata?.topologyRole ?? 'unknown',
    group: n.parent,
    w: Math.max(132, n.label.length * 7.2 + 24),
    h: 48,
  }))
const indexes = new Map(nodeSpecs.map((n, i) => [n.id, i]))
const root = indexes.get('test:internet')
if (root === undefined) throw new Error('Missing anchor')
const groupSpecs = [...graph.subgraphs]
  .filter((g) => nodeSpecs.some((n) => n.group === g.id))
  .sort((a, b) => a.id.localeCompare(b.id))
  .map((g) => ({
    id: g.id,
    label: g.label,
    members: nodeSpecs.flatMap((n, i) => (n.group === g.id ? [i] : [])),
  }))
const N = nodeSpecs.length
const G = groupSpecs.length
const dimension = N * 2
const gi = (g) => N * 2 + g * 4
const groupOf = new Map(groupSpecs.flatMap((g, j) => g.members.map((i) => [i, j])))
if (groupOf.size !== N) throw new Error('This experiment requires a parent for every node')
const pairs = new Map()
for (const link of graph.links) {
  const a = indexes.get(link.from.node)
  const b = indexes.get(link.to.node)
  if (a === undefined || b === undefined) throw new Error('Broken reference')
  if (a === b) continue
  const key = [a, b].sort((x, y) => x - y).join(':')
  if (!pairs.has(key)) pairs.set(key, { a, b })
}
const relations = [...pairs.values()]
const groupPairs = new Map()
for (const e of relations) {
  const a = groupOf.get(e.a)
  const b = groupOf.get(e.b)
  if (a === b) continue
  const key = [a, b].sort((x, y) => x - y).join(':')
  const pair = groupPairs.get(key) ?? { a, b, nodePairs: [] }
  pair.nodePairs.push(e)
  groupPairs.set(key, pair)
}
const groupRelations = [...groupPairs.values()]
const zero = () => new Float64Array(dimension)
// Conservative smooth enclosing bounds: differentiable through ALL member coordinates.
// Temperature is numerical smoothing (8px), not a minimum group dimension.
function boundary(z, members, axis, sign, padding) {
  const values = members.map(
    (i) => sign * z[2 * i + axis] + (axis === 0 ? nodeSpecs[i].w : nodeSpecs[i].h) / 2,
  )
  const maximum = Math.max(...values)
  const weights = values.map((v) => Math.exp((v - maximum) / 8))
  const total = weights.reduce((a, b) => a + b, 0)
  return {
    value: sign * (maximum + 8 * Math.log(total) + padding),
    terms: members.map((i, j) => [2 * i + axis, weights[j] / total]),
  }
}
function boxes(z) {
  return groupSpecs.map((g) => {
    const left = boundary(z, g.members, 0, -1, 20)
    const right = boundary(z, g.members, 0, 1, 20)
    const top = boundary(z, g.members, 1, -1, 36)
    const bottom = boundary(z, g.members, 1, 1, 36)
    return {
      x: (left.value + right.value) / 2,
      y: (top.value + bottom.value) / 2,
      hw: (right.value - left.value) / 2,
      hh: (bottom.value - top.value) / 2,
      tx: [...left.terms, ...right.terms].map(([i, v]) => [i, v / 2]),
      ty: [...top.terms, ...bottom.terms].map(([i, v]) => [i, v / 2]),
      tw: [...left.terms.map(([i, v]) => [i, -v / 2]), ...right.terms.map(([i, v]) => [i, v / 2])],
      th: [...top.terms.map(([i, v]) => [i, -v / 2]), ...bottom.terms.map(([i, v]) => [i, v / 2])],
    }
  })
}
const scale = (terms, s) => terms.map(([i, v]) => [i, v * s])
function evaluate(z, gradient = true) {
  const d = zero()
  const curvature = new Float64Array(dimension).fill(0.1)
  const losses = {}
  const add = (name, value, weight, terms) => {
    losses[name] = (losses[name] ?? 0) + weight * value * value
    if (!gradient) return
    // Aggregate repeated coordinates before diagonal approximation.
    const combined = new Map()
    for (const [i, v] of terms) combined.set(i, (combined.get(i) ?? 0) + v)
    for (const [i, v] of combined) {
      d[i] += 2 * weight * value * v
      curvature[i] += 2 * weight * v * v
    }
  }
  const bs = boxes(z)
  for (const { a, b } of relations) {
    const dx = z[2 * a] - z[2 * b],
      dy = z[2 * a + 1] - z[2 * b + 1]
    const r = Math.max(0.001, Math.hypot(dx, dy))
    // Uniform connection-length objective; no degree, role, hop or direction weighting.
    // A 240px upper slack leaves local freedom; non-overlap supplies separation.
    if (r > 240)
      add('node-dependency', r - 240, 1, [
        [2 * a, dx / r],
        [2 * b, -dx / r],
        [2 * a + 1, dy / r],
        [2 * b + 1, -dy / r],
      ])
  }
  for (const { a, b } of groupRelations) {
    const A = bs[a],
      B = bs[b]
    // Distance between enclosing rectangles, not a separately chosen group centre.
    const dx = A.x - B.x,
      dy = A.y - B.y
    const gx = Math.max(0, Math.abs(dx) - A.hw - B.hw)
    const gy = Math.max(0, Math.abs(dy) - A.hh - B.hh)
    const r = Math.hypot(gx, gy)
    if (r <= 100) continue
    const terms = []
    if (gx > 0)
      terms.push(
        ...scale(A.tx, (Math.sign(dx) * gx) / r),
        ...scale(B.tx, (-Math.sign(dx) * gx) / r),
        ...scale(A.tw, -gx / r),
        ...scale(B.tw, -gx / r),
      )
    if (gy > 0)
      terms.push(
        ...scale(A.ty, (Math.sign(dy) * gy) / r),
        ...scale(B.ty, (-Math.sign(dy) * gy) / r),
        ...scale(A.th, -gy / r),
        ...scale(B.th, -gy / r),
      )
    // One term per adjacent group pair: no bandwidth or parallel-link multiplier.
    add('subgraph-dependency', r - 100, 1, terms)
  }
  for (const [i, n] of nodeSpecs.entries())
    for (const j of sequence(i)) {
      const m = nodeSpecs[j],
        dx = z[2 * i] - z[2 * j],
        dy = z[2 * i + 1] - z[2 * j + 1]
      const ox = (n.w + m.w) / 2 + 18 - Math.abs(dx),
        oy = (n.h + m.h) / 2 + 18 - Math.abs(dy)
      if (ox <= 0 || oy <= 0) continue
      const sum = ox + oy,
        gx = (oy / sum) ** 2 * (Math.sign(dx) || 1),
        gy = (ox / sum) ** 2 * (Math.sign(dy) || 1)
      add('node-overlap', (ox * oy) / sum, 3000, [
        [2 * i, -gx],
        [2 * j, gx],
        [2 * i + 1, -gy],
        [2 * j + 1, gy],
      ])
    }
  for (const [a, A] of bs.entries())
    for (const b of sequence(a)) {
      const B = bs[b],
        dx = A.x - B.x,
        dy = A.y - B.y
      const ox = A.hw + B.hw + 26 - Math.abs(dx),
        oy = A.hh + B.hh + 26 - Math.abs(dy)
      if (ox <= 0 || oy <= 0) continue
      const sum = ox + oy,
        gx = (oy / sum) ** 2,
        gy = (ox / sum) ** 2
      add('group-overlap', (ox * oy) / sum, 3000, [
        ...scale(A.tx, -gx * (Math.sign(dx) || 1)),
        ...scale(B.tx, gx * (Math.sign(dx) || 1)),
        ...scale(A.ty, -gy * (Math.sign(dy) || 1)),
        ...scale(B.ty, gy * (Math.sign(dy) || 1)),
        ...scale(A.tw, gx),
        ...scale(B.tw, gx),
        ...scale(A.th, gy),
        ...scale(B.th, gy),
      ])
    }
  return { cost: Object.values(losses).reduce((a, b) => a + b, 0), d, curvature, losses }
}
function initial(seed) {
  let state = 12345 + seed * 97531
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
  const z = zero()
  // Random group centres/member offsets only; no levels, root radius, packing or degree order.
  for (const g of groupSpecs) {
    const x = (random() - 0.5) * 2600,
      y = (random() - 0.5) * 2600
    for (const i of g.members) {
      z[2 * i] = x + (random() - 0.5) * 500
      z[2 * i + 1] = y + (random() - 0.5) * 400
    }
  }
  const rx = z[2 * root],
    ry = z[2 * root + 1]
  for (const i of sequence(N)) {
    z[2 * i] -= rx
    z[2 * i + 1] -= ry
  }
  return z
}
function violations(z) {
  let nodeOverlaps = 0,
    groupOverlaps = 0
  const bs = boxes(z)
  for (const [i, n] of nodeSpecs.entries())
    for (const j of sequence(i))
      if (
        Math.abs(z[2 * i] - z[2 * j]) < (n.w + nodeSpecs[j].w) / 2 &&
        Math.abs(z[2 * i + 1] - z[2 * j + 1]) < (n.h + nodeSpecs[j].h) / 2
      )
        nodeOverlaps++
  for (const [a, A] of bs.entries())
    for (const b of sequence(a)) {
      const B = bs[b]
      if (Math.abs(A.x - B.x) < A.hw + B.hw && Math.abs(A.y - B.y) < A.hh + B.hh) groupOverlaps++
    }
  return { nodeOverlaps, groupOverlaps, anchorError: Math.hypot(z[2 * root], z[2 * root + 1]) }
}

export {
  boxes,
  evaluate,
  G,
  groupRelations,
  groupSpecs,
  N,
  nodeSpecs,
  relations,
  root,
  sourceText,
  violations,
}

export function renderPlacement(nodePositions, showLinks, title) {
  const z = new Float64Array(N * 2 + G * 4)
  z.set(nodePositions)
  for (const [g, b] of boxes(nodePositions).entries()) z.set([b.x, b.y, b.hw, b.hh], gi(g))
  const escapeXml = (s) =>
    String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
  const palette = ['#3e7c91', '#936844', '#5e7d57', '#846da6', '#397b74', '#977542', '#546dae']
  const minX = Math.min(...groupSpecs.map((_, g) => z[gi(g)] - z[gi(g) + 2])) - 70
  const minY = Math.min(...groupSpecs.map((_, g) => z[gi(g) + 1] - z[gi(g) + 3])) - 140
  const maxX = Math.max(...groupSpecs.map((_, g) => z[gi(g)] + z[gi(g) + 2])) + 70
  const maxY = Math.max(...groupSpecs.map((_, g) => z[gi(g) + 1] + z[gi(g) + 3])) + 70

  function svg(showLinks) {
    const p = [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}" font-family="Segoe UI, sans-serif">`,
      `<rect x="${minX}" y="${minY}" width="${maxX - minX}" height="${maxY - minY}" fill="#f4f6f8"/>`,
      `<text x="${minX + 25}" y="${minY + 40}" font-size="25" fill="#172c40">${escapeXml(title)} · 89 nodes / 160 links</text>`,
      `<text x="${minX + 25}" y="${minY + 67}" font-size="14" fill="#516677">Node positions jointly optimized; group bounds derived from members · ${showLinks ? 'straight connections; no routing cost' : 'placement only; same coordinates'}</text>`,
    ]
    for (const [g, spec] of groupSpecs.entries()) {
      const k = gi(g)
      const color = palette[g % palette.length]
      p.push(
        `<rect x="${z[k] - z[k + 2]}" y="${z[k + 1] - z[k + 3]}" width="${z[k + 2] * 2}" height="${z[k + 3] * 2}" rx="18" fill="${color}" fill-opacity="0.045" stroke="${color}" stroke-opacity="0.5"/>`,
      )
      p.push(
        `<text x="${z[k] - z[k + 2] + 12}" y="${z[k + 1] - z[k + 3] + 21}" font-size="13" fill="${color}">${escapeXml(spec.label)}</text>`,
      )
    }
    if (showLinks)
      for (const link of graph.links) {
        const a = indexes.get(link.from.node)
        const b = indexes.get(link.to.node)
        if (a === undefined || b === undefined) continue
        const role = link.metadata?.topologyRole
        const fallback = role === 'fallback'
        const peer = role === 'floor-peer'
        p.push(
          `<path d="M ${z[2 * a]} ${z[2 * a + 1]} L ${z[2 * b]} ${z[2 * b + 1]}" fill="none" stroke="${peer ? '#c06b26' : '#435f7a'}" stroke-opacity="${fallback ? 0.1 : peer ? 0.5 : 0.24}" stroke-width="${peer ? 1.7 : 1.2}" ${peer || fallback ? 'stroke-dasharray="5 5"' : ''}/>`,
        )
      }
    for (const [i, n] of nodeSpecs.entries()) {
      const ap = n.role === 'wireless-ap'
      const poe = n.role === 'floor-poe-switch'
      p.push(
        `<g><title>${escapeXml(n.id)} / ${escapeXml(n.role)}</title><rect x="${z[2 * i] - n.w / 2}" y="${z[2 * i + 1] - n.h / 2}" width="${n.w}" height="${n.h}" rx="${ap ? 17 : 8}" fill="${poe ? '#e0efeb' : ap ? '#edf4fe' : '#ffffff'}" stroke="${poe ? '#348576' : '#8498ad'}"/><text x="${z[2 * i]}" y="${z[2 * i + 1] - 1}" text-anchor="middle" font-size="12" fill="#172c40">${escapeXml(n.label)}</text><text x="${z[2 * i]}" y="${z[2 * i + 1] + 14}" text-anchor="middle" font-size="9" fill="#61758a">${escapeXml(n.role)}</text></g>`,
      )
    }
    return `${p.join('\n')}</svg>`
  }

  return svg(showLinks)
}

if (import.meta.main) {
  const probe = initial(42)
  const analytical = evaluate(probe)
  let gradientRelativeError = 0
  for (const i of sequence(dimension)) {
    const plus = probe.slice(),
      minus = probe.slice(),
      eps = 0.0001
    plus[i] += eps
    minus[i] -= eps
    const numeric = (evaluate(plus, false).cost - evaluate(minus, false).cost) / (2 * eps)
    gradientRelativeError = Math.max(
      gradientRelativeError,
      Math.abs(numeric - analytical.d[i]) /
        Math.max(1, Math.abs(numeric), Math.abs(analytical.d[i])),
    )
  }
  if (gradientRelativeError > 0.002) throw new Error(`Gradient mismatch ${gradientRelativeError}`)
  console.log('gradient error', gradientRelativeError)
  const candidates = []
  for (const seed of sequence(3)) {
    let z = initial(seed),
      result = evaluate(z)
    const startCost = result.cost
    for (const iteration of sequence(10000)) {
      let step = 1,
        accepted = false
      for (const _attempt of sequence(20)) {
        const trial = Float64Array.from(z, (v, i) => v - (step * result.d[i]) / result.curvature[i])
        trial[2 * root] = 0
        trial[2 * root + 1] = 0
        if (evaluate(trial, false).cost < result.cost) {
          z = trial
          result = evaluate(z)
          accepted = true
          break
        }
        step *= 0.5
      }
      if (!accepted) break
      if (iteration % 2000 === 1999) console.log(seed, iteration + 1, Math.round(result.cost))
    }
    const checks = violations(z)
    candidates.push({ z, cost: result.cost, startCost, losses: result.losses, checks, seed })
    console.log(JSON.stringify({ seed, cost: result.cost, checks }))
  }
  // Feasibility-first selection retained only as a solver safeguard, not a spatial preference.
  candidates.sort(
    (a, b) =>
      a.checks.nodeOverlaps +
        a.checks.groupOverlaps -
        (b.checks.nodeOverlaps + b.checks.groupOverlaps) || a.cost - b.cost,
  )
  const best = candidates[0]
  if (!best) throw new Error('No candidate')
  const z = new Float64Array(N * 2 + G * 4)
  z.set(best.z)
  for (const [g, b] of boxes(best.z).entries()) z.set([b.x, b.y, b.hw, b.hh], gi(g))
  const escapeXml = (s) =>
    String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
  const palette = ['#3e7c91', '#936844', '#5e7d57', '#846da6', '#397b74', '#977542', '#546dae']
  const minX = Math.min(...groupSpecs.map((_, g) => z[gi(g)] - z[gi(g) + 2])) - 70
  const minY = Math.min(...groupSpecs.map((_, g) => z[gi(g) + 1] - z[gi(g) + 3])) - 140
  const maxX = Math.max(...groupSpecs.map((_, g) => z[gi(g)] + z[gi(g) + 2])) + 70
  const maxY = Math.max(...groupSpecs.map((_, g) => z[gi(g) + 1] + z[gi(g) + 3])) + 70

  function svg(showLinks) {
    const p = [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}" font-family="Segoe UI, sans-serif">`,
      `<rect x="${minX}" y="${minY}" width="${maxX - minX}" height="${maxY - minY}" fill="#f4f6f8"/>`,
      `<text x="${minX + 25}" y="${minY + 40}" font-size="25" fill="#172c40">Dependency-only placement experiment · 89 nodes / 160 links</text>`,
      `<text x="${minX + 25}" y="${minY + 67}" font-size="14" fill="#516677">Node positions jointly optimized; group bounds derived from members · ${showLinks ? 'straight connections; no routing cost' : 'placement only; same coordinates'}</text>`,
    ]
    for (const [g, spec] of groupSpecs.entries()) {
      const k = gi(g)
      const color = palette[g % palette.length]
      p.push(
        `<rect x="${z[k] - z[k + 2]}" y="${z[k + 1] - z[k + 3]}" width="${z[k + 2] * 2}" height="${z[k + 3] * 2}" rx="18" fill="${color}" fill-opacity="0.045" stroke="${color}" stroke-opacity="0.5"/>`,
      )
      p.push(
        `<text x="${z[k] - z[k + 2] + 12}" y="${z[k + 1] - z[k + 3] + 21}" font-size="13" fill="${color}">${escapeXml(spec.label)}</text>`,
      )
    }
    if (showLinks)
      for (const link of graph.links) {
        const a = indexes.get(link.from.node)
        const b = indexes.get(link.to.node)
        if (a === undefined || b === undefined) continue
        const role = link.metadata?.topologyRole
        const fallback = role === 'fallback'
        const peer = role === 'floor-peer'
        p.push(
          `<path d="M ${z[2 * a]} ${z[2 * a + 1]} L ${z[2 * b]} ${z[2 * b + 1]}" fill="none" stroke="${peer ? '#c06b26' : '#435f7a'}" stroke-opacity="${fallback ? 0.1 : peer ? 0.5 : 0.24}" stroke-width="${peer ? 1.7 : 1.2}" ${peer || fallback ? 'stroke-dasharray="5 5"' : ''}/>`,
        )
      }
    for (const [i, n] of nodeSpecs.entries()) {
      const ap = n.role === 'wireless-ap'
      const poe = n.role === 'floor-poe-switch'
      p.push(
        `<g><title>${escapeXml(n.id)} / ${escapeXml(n.role)}</title><rect x="${z[2 * i] - n.w / 2}" y="${z[2 * i + 1] - n.h / 2}" width="${n.w}" height="${n.h}" rx="${ap ? 17 : 8}" fill="${poe ? '#e0efeb' : ap ? '#edf4fe' : '#ffffff'}" stroke="${poe ? '#348576' : '#8498ad'}"/><text x="${z[2 * i]}" y="${z[2 * i + 1] - 1}" text-anchor="middle" font-size="12" fill="#172c40">${escapeXml(n.label)}</text><text x="${z[2 * i]}" y="${z[2 * i + 1] + 14}" text-anchor="middle" font-size="9" fill="#61758a">${escapeXml(n.role)}</text></g>`,
      )
    }
    return `${p.join('\n')}</svg>`
  }

  await Bun.write(`${outputBase}.svg`, svg(true))
  await Bun.write(`${outputBase}-only.svg`, svg(false))

  await Bun.write(
    `${outputBase}-report.json`,
    JSON.stringify(
      {
        inputPath,
        inputHash: createHash('sha256').update(sourceText).digest('hex'),
        nodes: N,
        links: graph.links.length,
        groups: G,
        uniqueNodeRelations: relations.length,
        groupRelations,
        variables: dimension,
        gradientRelativeError,
        selectedSeed: best.seed,
        assumptions: [
          'Undirected adjacency, not inferred causal/upstream dependencies',
          'Root exactly pinned at (0,0); no preferred direction',
          'Smooth enclosing rectangles derived from members; no independent group minimum/size loss',
          'Uniform node edge upper distance 240px; adjacent group boundary gap upper distance 100px',
          'Equal weight per unique node pair and per unique group pair; intentional two-scale evaluation',
          'Node and group non-overlap are finite penalties, not solver guarantees',
          'Random group/member initialization; no topology-guided initial ordering',
          '3 starts, joint backtracking descent, feasibility-first candidate selection',
        ],
        candidates: candidates.map(({ z: _z, ...c }) => c),
        positions: nodeSpecs.map((n, i) => ({ ...n, x: z[2 * i], y: z[2 * i + 1] })),
        bounds: groupSpecs.map((g, i) => ({
          ...g,
          x: z[gi(i)],
          y: z[gi(i) + 1],
          hw: z[gi(i) + 2],
          hh: z[gi(i) + 3],
        })),
      },
      null,
      2,
    ),
  )
  console.log('SELECTED', best.seed, best.checks)
}
