import { createHash } from 'node:crypto'

// Research-only joint optimizer. No routed geometry or line widths enter its loss.
const inputPath = 'tmp-test6-complete-upstream-to-ap.json'
const sourceText = await Bun.file(inputPath).text()
const graph = JSON.parse(sourceText)
const roleFree = process.argv.includes('--role-free')
const outputBase = roleFree ? 'tmp-test6-role-free-placement' : 'tmp-test6-joint-placement'
const sequence = (n) => Array.from({ length: n }, (_, i) => i)
const roles = {
  internet: 0,
  provider: 1,
  border: 2,
  core: 3,
  aggregation: 4,
  datacenter: 4.4,
  service: 4.7,
  access: 5.5,
  fallback: 4.5,
  'floor-poe-switch': 7,
  'wireless-ap': 8,
}
const nodeSpecs = [...graph.nodes]
  .sort((a, b) => a.id.localeCompare(b.id))
  .map((n) => ({
    id: n.id,
    label: n.label,
    role: n.metadata?.topologyRole ?? 'unknown',
    rank: roleFree ? null : (roles[n.metadata?.topologyRole] ?? 4.5),
    group: n.parent,
    w: Math.max(132, n.label.length * 7.2 + 24),
    h: 48,
  }))
const indexes = new Map(nodeSpecs.map((n, i) => [n.id, i]))
const externalRoot = indexes.get('test:internet')
if (externalRoot === undefined) throw new Error('Explicit external attachment point is missing')
const neighbors = nodeSpecs.map(() => new Set())
for (const link of graph.links) {
  const a = indexes.get(link.from.node)
  const b = indexes.get(link.to.node)
  if (a === undefined || b === undefined) throw new Error('Broken endpoint reference')
  neighbors[a].add(b)
  neighbors[b].add(a)
}
const hops = nodeSpecs.map(() => Number.POSITIVE_INFINITY)
hops[externalRoot] = 0
const frontier = [externalRoot]
for (const i of frontier)
  for (const j of neighbors[i]) {
    if (Number.isFinite(hops[j])) continue
    hops[j] = hops[i] + 1
    frontier.push(j)
  }
if (hops.some((hop) => !Number.isFinite(hop)))
  throw new Error('Disconnected component needs its own anchor')
const groupSpecs = [...graph.subgraphs]
  .filter((g) => nodeSpecs.some((n) => n.group === g.id))
  .sort((a, b) => a.id.localeCompare(b.id))
  .map((g) => ({
    id: g.id,
    label: g.label,
    members: nodeSpecs.flatMap((n, i) => (n.group === g.id ? [i] : [])),
  }))
const pairs = new Map()
for (const link of graph.links) {
  const a = indexes.get(link.from.node)
  const b = indexes.get(link.to.node)
  if (a === undefined || b === undefined) throw new Error(`Unresolved link ${link.id}`)
  const key = [a, b].sort((x, y) => x - y).join(':')
  const existing = pairs.get(key)
  if (existing) {
    existing.links.push(link.id)
    continue
  }
  const na = nodeSpecs[a]
  const nb = nodeSpecs[b]
  const role = roleFree ? 'connection' : (link.metadata?.topologyRole ?? 'unknown')
  const fallback = role === 'fallback' || na.role === 'fallback' || nb.role === 'fallback'
  const peer = role === 'floor-peer' || role === 'peer' || role === 'ha-interconnect'
  const delta = roleFree ? hops[b] - hops[a] : nb.rank - na.rank
  // Observed LLDP direction is never assumed to be hierarchy direction.
  const directed = roleFree ? delta !== 0 : !peer && !fallback && Math.abs(delta) > 0.1
  const u = directed && delta < 0 ? b : a
  const v = directed && delta < 0 ? a : b
  const explicit = !roleFree && link.metadata?.testFixture === true && directed
  pairs.set(key, {
    a: u,
    b: v,
    role,
    directed,
    explicit,
    links: [link.id],
    weight: roleFree
      ? 0.5 / Math.sqrt(neighbors[a].size * neighbors[b].size)
      : fallback
        ? 0.006
        : role === 'access'
          ? 0.7
          : peer
            ? 0.045
            : 0.1,
    gap: 85,
    distance: role === 'access' ? 150 : peer ? 300 : 240,
  })
}
const relations = [...pairs.values()]
// Hints describe role levels, not fixed y coordinates. All x/y remain variables.
const N = nodeSpecs.length
const G = groupSpecs.length
const dimension = N * 2 + G * 4
const gi = (g) => N * 2 + g * 4

function polarInitial(seed) {
  const z = new Float64Array(dimension)
  const occupied = []
  const order = groupSpecs
    .map((spec, g) => ({
      g,
      hop: spec.members.reduce((sum, i) => sum + hops[i], 0) / spec.members.length,
    }))
    .sort((a, b) => a.hop - b.hop || a.g - b.g)
  for (const { g, hop } of order) {
    const spec = groupSpecs[g]
    // High-degree members seed the centre; all other members have local polar coordinates.
    const members = [...spec.members].sort((a, b) => neighbors[b].size - neighbors[a].size || a - b)
    const centre = members.includes(externalRoot) ? externalRoot : members[0]
    if (centre === undefined) continue
    const others = members.filter((i) => i !== centre)
    const radius = 110 + Math.sqrt(others.length) * 65
    for (const [j, i] of others.entries()) {
      const angle = ((j + 0.23 * seed) * Math.PI * 2) / Math.max(1, others.length)
      z[2 * i] = radius * Math.sin(angle)
      z[2 * i + 1] = radius * Math.cos(angle)
    }
    const x1 = Math.min(...members.map((i) => z[2 * i] - nodeSpecs[i].w / 2)) - 25
    const x2 = Math.max(...members.map((i) => z[2 * i] + nodeSpecs[i].w / 2)) + 25
    const y1 = Math.min(...members.map((i) => z[2 * i + 1] - nodeSpecs[i].h / 2)) - 40
    const y2 = Math.max(...members.map((i) => z[2 * i + 1] + nodeSpecs[i].h / 2)) + 40
    const hw = Math.max(90, (x2 - x1) / 2)
    const hh = Math.max(60, (y2 - y1) / 2)
    const hasRoot = members.includes(externalRoot)
    let cx = 0
    let cy = hh
    for (const attempt of sequence(300)) {
      const angle = ((((g + 1) * 0.61803398875 + seed * 0.137 + attempt * 0.037) % 1) - 0.5) * 2.5
      const distance = 320 + hop * 310 + attempt * 35
      cx = hasRoot ? 0 : Math.sin(angle) * distance * 1.25
      cy = hasRoot ? hh : Math.cos(angle) * distance + 400
      if (
        occupied.every(
          (box) =>
            Math.abs(cx - box.cx) >= hw + box.hw + 45 || Math.abs(cy - box.cy) >= hh + box.hh + 45,
        )
      )
        break
    }
    occupied.push({ cx, cy, hw, hh })
    const k = gi(g)
    z[k] = cx
    z[k + 1] = cy
    z[k + 2] = hw
    z[k + 3] = hh
    for (const i of members) {
      z[2 * i] += cx - (x1 + x2) / 2
      z[2 * i + 1] += cy - (y1 + y2) / 2
    }
  }
  return z
}

function initial(seed) {
  if (roleFree) return polarInitial(seed)
  const z = new Float64Array(dimension)
  const bands = new Map()
  for (const [g, spec] of groupSpecs.entries()) {
    const rank = spec.members.reduce((s, i) => s + nodeSpecs[i].rank, 0) / spec.members.length
    const band = Math.round(rank)
    const bandMembers = bands.get(band) ?? []
    bandMembers.push(g)
    bands.set(band, bandMembers)
    const ranks = [...new Set(spec.members.map((i) => nodeSpecs[i].rank))].sort((a, b) => a - b)
    let y = 0
    for (const r of ranks) {
      const rowMembers = spec.members.filter((i) => nodeSpecs[i].rank === r)
      const cols = Math.min(3, rowMembers.length)
      const stride = Math.max(...rowMembers.map((i) => nodeSpecs[i].w)) + 45
      for (const [j, i] of rowMembers.entries()) {
        z[2 * i] = ((j % cols) - (cols - 1) / 2) * stride
        z[2 * i + 1] = y + Math.floor(j / cols) * 95 + Math.sin((i + 1) * 2.4 + seed) * 6
      }
      y += Math.ceil(rowMembers.length / cols) * 95 + 45
    }
    const x1 = Math.min(...spec.members.map((i) => z[2 * i] - nodeSpecs[i].w / 2)) - 25
    const x2 = Math.max(...spec.members.map((i) => z[2 * i] + nodeSpecs[i].w / 2)) + 25
    const y1 = Math.min(...spec.members.map((i) => z[2 * i + 1] - nodeSpecs[i].h / 2)) - 40
    const y2 = Math.max(...spec.members.map((i) => z[2 * i + 1] + nodeSpecs[i].h / 2)) + 40
    const k = gi(g)
    z[k] = (x1 + x2) / 2
    z[k + 1] = (y1 + y2) / 2
    z[k + 2] = Math.max(90, (x2 - x1) / 2)
    z[k + 3] = Math.max(60, (y2 - y1) / 2)
  }
  // Only a feasible initial guess; no row, order, or group coordinates are fixed afterward.
  let y = 0
  for (const [, groups] of [...bands.entries()].sort((a, b) => a[0] - b[0])) {
    groups.sort((a, b) => Math.sin((a + 1) * 2.4 + seed) - Math.sin((b + 1) * 2.4 + seed))
    const height = Math.max(...groups.map((g) => z[gi(g) + 3] * 2))
    let x = -groups.reduce((sum, g) => sum + z[gi(g) + 2] * 2 + 65, -65) / 2
    for (const g of groups) {
      const k = gi(g)
      const dx = x + z[k + 2] - z[k]
      const dy = y + height / 2 - z[k + 1]
      z[k] += dx
      z[k + 1] += dy
      for (const i of groupSpecs[g].members) {
        z[2 * i] += dx
        z[2 * i + 1] += dy
      }
      x += z[k + 2] * 2 + 65
    }
    y += height + 140
  }
  return z
}

function evaluate(z, gradient = true) {
  const d = new Float64Array(dimension)
  const curvature = new Float64Array(dimension).fill(0.02)
  const losses = {}
  const add = (name, value, weight, terms) => {
    losses[name] = (losses[name] ?? 0) + weight * value * value
    if (gradient)
      for (const [index, derivative] of terms) {
        d[index] += 2 * weight * value * derivative
        curvature[index] += 2 * weight * derivative * derivative
      }
  }
  const hinge = (name, value, weight, terms) => {
    if (value > 0) add(name, value, weight, terms)
  }
  for (const e of relations) {
    const ax = 2 * e.a
    const bx = 2 * e.b
    const dx = z[bx] - z[ax]
    const dy = z[bx + 1] - z[ax + 1]
    const r = Math.max(0.001, Math.hypot(dx, dy))
    // A radial interval rather than one preferred point: room for organic adjustment.
    const terms = [
      [ax, -dx / r],
      [ax + 1, -dy / r],
      [bx, dx / r],
      [bx + 1, dy / r],
    ]
    hinge('distance', r - e.distance * 1.6, e.weight, terms)
    hinge(
      'distance',
      e.distance * 0.6 - r,
      e.weight,
      terms.map(([i, v]) => [i, -v]),
    )
    if (e.directed) {
      hinge('direction', e.gap - dy, roleFree ? 0.09 : e.explicit ? 45 : 0.8, [
        [ax + 1, 1],
        [bx + 1, -1],
      ])
      // Downstream angular cone. dx remains free inside the cone.
      hinge('angle', Math.abs(dx) - Math.max(0, dy) * 1.8 - 90, roleFree ? 0 : 0.018, [
        [ax, -Math.sign(dx)],
        [bx, Math.sign(dx)],
        [ax + 1, dy > 0 ? 1.8 : 0],
        [bx + 1, dy > 0 ? -1.8 : 0],
      ])
    } else if (e.role === 'floor-peer' || e.role === 'ha-interconnect') {
      hinge('peer-height', Math.abs(dy) - 100, 0.015, [
        [ax + 1, -Math.sign(dy)],
        [bx + 1, Math.sign(dy)],
      ])
    }
  }
  for (const [i, n] of nodeSpecs.entries()) {
    if (!roleFree) add('role-hint', z[2 * i + 1] - n.rank * 225, 0.003 / N, [[2 * i + 1, 1]])
    if (roleFree && i !== externalRoot) {
      hinge('external-boundary', 75 - z[2 * i + 1] + z[2 * externalRoot + 1], 45, [
        [2 * i + 1, -1],
        [2 * externalRoot + 1, 1],
      ])
    }
    add('extent', z[2 * i], 0.00002, [[2 * i, 1]])
    for (const j of sequence(i)) {
      const m = nodeSpecs[j]
      const dx = z[2 * i] - z[2 * j]
      const dy = z[2 * i + 1] - z[2 * j + 1]
      const ox = (n.w + m.w) / 2 + 18 - Math.abs(dx)
      const oy = (n.h + m.h) / 2 + 18 - Math.abs(dy)
      if (ox > 0 && oy > 0) {
        const sum = ox + oy
        const gx = (oy / sum) ** 2 * (Math.sign(dx) || 1)
        const gy = (ox / sum) ** 2 * (Math.sign(dy) || 1)
        add('node-overlap', (ox * oy) / sum, 350, [
          [2 * i, -gx],
          [2 * j, gx],
          [2 * i + 1, -gy],
          [2 * j + 1, gy],
        ])
      }
    }
  }
  for (const [g, spec] of groupSpecs.entries()) {
    const k = gi(g)
    // Bounds are independent optimization variables, jointly solved with nodes.
    for (const i of spec.members) {
      const n = nodeSpecs[i]
      const dx = z[2 * i] - z[k]
      const dy = z[2 * i + 1] - z[k + 1]
      hinge('containment', Math.abs(dx) + n.w / 2 + 20 - z[k + 2], 180, [
        [2 * i, Math.sign(dx)],
        [k, -Math.sign(dx)],
        [k + 2, -1],
      ])
      hinge('containment', Math.abs(dy) + n.h / 2 + 36 - z[k + 3], 180, [
        [2 * i + 1, Math.sign(dy)],
        [k + 1, -Math.sign(dy)],
        [k + 3, -1],
      ])
      add('group-cohesion', dx, 0.006 / spec.members.length, [
        [2 * i, 1],
        [k, -1],
      ])
      add('group-cohesion', dy, 0.006 / spec.members.length, [
        [2 * i + 1, 1],
        [k + 1, -1],
      ])
    }
    add('group-size', z[k + 2], 0.009, [[k + 2, 1]])
    add('group-size', z[k + 3], 0.009, [[k + 3, 1]])
    for (const h of sequence(g)) {
      const l = gi(h)
      const dx = z[k] - z[l]
      const dy = z[k + 1] - z[l + 1]
      const ox = z[k + 2] + z[l + 2] + 26 - Math.abs(dx)
      const oy = z[k + 3] + z[l + 3] + 26 - Math.abs(dy)
      if (ox > 0 && oy > 0) {
        const sum = ox + oy
        const gx = (oy / sum) ** 2
        const gy = (ox / sum) ** 2
        const sx = Math.sign(dx) || 1
        const sy = Math.sign(dy) || 1
        add('group-overlap', (ox * oy) / sum, 450, [
          [k, -gx * sx],
          [l, gx * sx],
          [k + 1, -gy * sy],
          [l + 1, gy * sy],
          [k + 2, gx],
          [l + 2, gx],
          [k + 3, gy],
          [l + 3, gy],
        ])
      }
    }
  }
  const root = indexes.get('test:internet')
  if (root !== undefined) {
    add('anchor', z[2 * root], 2, [[2 * root, 1]])
    add('anchor', z[2 * root + 1], 2, [[2 * root + 1, 1]])
  }
  return { cost: Object.values(losses).reduce((a, b) => a + b, 0), d, curvature, losses }
}

function violations(z) {
  let nodeOverlaps = 0
  let groupOverlaps = 0
  let outside = 0
  let reversedExplicit = 0
  for (const [i, n] of nodeSpecs.entries())
    for (const j of sequence(i)) {
      if (
        Math.abs(z[2 * i] - z[2 * j]) < (n.w + nodeSpecs[j].w) / 2 &&
        Math.abs(z[2 * i + 1] - z[2 * j + 1]) < (n.h + nodeSpecs[j].h) / 2
      )
        nodeOverlaps++
    }
  for (const [g, spec] of groupSpecs.entries()) {
    const k = gi(g)
    for (const i of spec.members) {
      if (
        Math.abs(z[2 * i] - z[k]) + nodeSpecs[i].w / 2 > z[k + 2] + 0.5 ||
        Math.abs(z[2 * i + 1] - z[k + 1]) + nodeSpecs[i].h / 2 > z[k + 3] + 0.5
      )
        outside++
    }
    for (const h of sequence(g)) {
      const l = gi(h)
      if (
        Math.abs(z[k] - z[l]) < z[k + 2] + z[l + 2] &&
        Math.abs(z[k + 1] - z[l + 1]) < z[k + 3] + z[l + 3]
      )
        groupOverlaps++
    }
  }
  for (const e of relations)
    if (e.explicit && z[2 * e.b + 1] - z[2 * e.a + 1] < e.gap - 1) reversedExplicit++
  const rootBoundaryViolations = roleFree
    ? nodeSpecs.filter((_, i) => i !== externalRoot && z[2 * i + 1] - z[2 * externalRoot + 1] < 74)
        .length
    : 0
  return {
    nodeOverlaps,
    groupOverlaps,
    outside,
    explicitGapViolations: reversedExplicit,
    rootBoundaryViolations,
  }
}

const candidates = []
// Finite differences catch inconsistent energy/gradient implementations.
const probe = Float64Array.from(initial(0), (value, i) => value + Math.sin(i + 0.7) * 0.123)
const analytical = evaluate(probe)
let gradientRelativeError = 0
for (const i of sequence(dimension)) {
  const plus = probe.slice()
  const minus = probe.slice()
  const epsilon = 0.0001
  plus[i] += epsilon
  minus[i] -= epsilon
  const numeric = (evaluate(plus, false).cost - evaluate(minus, false).cost) / (2 * epsilon)
  gradientRelativeError = Math.max(
    gradientRelativeError,
    Math.abs(numeric - analytical.d[i]) / Math.max(1, Math.abs(numeric), Math.abs(analytical.d[i])),
  )
}
if (gradientRelativeError > 0.002) throw new Error(`Gradient mismatch ${gradientRelativeError}`)
console.log('gradient relative error', gradientRelativeError)
for (const seed of sequence(5)) {
  let z = initial(seed)
  let result = evaluate(z)
  const startCost = result.cost
  // Backtracking descent on the SAME loss for all nodes and group bounds.
  for (const iteration of sequence(6000)) {
    let step = 1
    let accepted = false
    for (const _attempt of sequence(15)) {
      const trial = Float64Array.from(
        z,
        (value, i) => value - (step * result.d[i]) / result.curvature[i],
      )
      for (const [g] of groupSpecs.entries()) {
        const k = gi(g)
        trial[k + 2] = Math.max(90, trial[k + 2])
        trial[k + 3] = Math.max(60, trial[k + 3])
      }
      const next = evaluate(trial, false)
      if (next.cost < result.cost) {
        z = trial
        result = evaluate(z)
        accepted = true
        break
      }
      step *= 0.5
    }
    if (!accepted) break
    if (iteration % 1000 === 999)
      console.log(`seed ${seed} iteration ${iteration + 1}: ${Math.round(result.cost)}`)
  }
  const checks = violations(z)
  candidates.push({ z, cost: result.cost, startCost, losses: result.losses, checks, seed })
  console.log(JSON.stringify({ seed, startCost, cost: result.cost, checks }))
}
candidates.sort(
  (a, b) =>
    Object.values(a.checks).reduce((s, n) => s + n, 0) -
      Object.values(b.checks).reduce((s, n) => s + n, 0) || a.cost - b.cost,
)
const best = candidates[0]
if (!best) throw new Error('No candidate')
const { z } = best
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
    `<text x="${minX + 25}" y="${minY + 40}" font-size="25" fill="#172c40">${roleFree ? 'Role-free' : 'Joint'} placement experiment · 89 nodes / 160 links</text>`,
    `<text x="${minX + 25}" y="${minY + 67}" font-size="14" fill="#516677">Nodes + group boundaries optimized together · ${showLinks ? 'straight connections; no routing cost' : 'placement only; same coordinates'}</text>`,
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
      roleFree,
      rootId: nodeSpecs[externalRoot].id,
      assumptions: roleFree
        ? [
            'Explicit external root only',
            'Undirected unweighted connectivity',
            'Hop distance gives a weak direction preference, not physical upstream truth',
            'Degree-normalized attraction; no bandwidth or fallback special treatment',
            'Polar initialization; no fixed role levels',
            'Node roles used in display styling only',
          ]
        : [],
      inputHash: createHash('sha256').update(sourceText).digest('hex'),
      selectedSeed: best.seed,
      nodes: N,
      links: graph.links.length,
      groups: G,
      relations: relations.length,
      variables: dimension,
      gradientRelativeError,
      note: 'Finite-penalty prototype; validation reports feasibility, not a hard-constraint guarantee. Role-free mode ignores node/link roles in optimization. Port labels and routing are excluded.',
      candidates: candidates.map(({ z: _z, ...c }) => c),
      positions: nodeSpecs.map((n, i) => ({
        ...n,
        x: z[2 * i],
        y: z[2 * i + 1],
        hopDistance: hops[i],
        uniqueNeighbors: neighbors[i].size,
      })),
      softDirection: {
        total: relations.filter((e) => e.directed).length,
        reversed: relations.filter((e) => e.directed && z[2 * e.b + 1] < z[2 * e.a + 1]).length,
      },
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
