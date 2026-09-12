import { createHash } from 'node:crypto'

const baselinePath = 'tmp-test6-v7-polar-report.json'
const baseline = await Bun.file(baselinePath).json()
const input = await Bun.file(baseline.inputPath).text()
if (createHash('sha256').update(input).digest('hex') !== baseline.inputHash)
  throw new Error('Fixture changed')
const outputBase = 'tmp-test6-v7-hierarchy'
const groups = baseline.groups
const nodes = baseline.nodes.map((n) => ({ ...n }))
const links = baseline.links
const terminals = baseline.terminals
const seq = (n) => Array.from({ length: n }, (_, i) => i)
const groupOf = new Map(groups.flatMap((g, gi) => g.members.map((i) => [i, gi])))
const root = nodes.findIndex((n) => n.id === 'test:internet')
const neighbors = nodes.map(() => new Set())
for (const l of links)
  if (l.ga === l.gb) {
    neighbors[l.a].add(l.b)
    neighbors[l.b].add(l.a)
  }
const depth = new Map(),
  parents = new Map(),
  hierarchies = []
const fixedGeometry = JSON.stringify({ groups, terminals })
function permutations(xs) {
  if (xs.length < 2) return [[...xs]]
  return xs.flatMap((v, i) =>
    permutations(xs.filter((_, j) => j !== i)).map((rest) => [v, ...rest]),
  )
}
// Choose a contiguous row partition: fewest rows, then balanced occupied widths.
function partition(order, width) {
  let best = null
  for (const mask of seq(2 ** Math.max(0, order.length - 1))) {
    const rows = [[]]
    for (const [i, node] of order.entries()) {
      rows[rows.length - 1].push(node)
      if (i < order.length - 1 && mask & (1 << i)) rows.push([])
    }
    const widths = rows.map(
      (row) => row.reduce((s, i) => s + nodes[i].w, 0) + 18 * (row.length - 1),
    )
    if (widths.some((w) => w > width + 1e-6)) continue
    const mean = widths.reduce((a, b) => a + b, 0) / widths.length
    const cost = rows.length * 1e9 + widths.reduce((s, w) => s + (w - mean) ** 2, 0)
    if (!best || cost < best.cost) best = { rows, widths, cost }
  }
  if (!best) throw new Error('Node row cannot fit')
  return best
}
for (const [gi, g] of groups.entries()) {
  const external = terminals.filter((t) => t.g === gi)
  const roots = g.members.includes(root) ? [root] : [...new Set(external.map((t) => t.node))]
  const syntheticRoots = []
  const flood = (seed) => {
    const q = [...seed]
    for (const i of seed) depth.set(i, 0)
    for (const i of q)
      for (const j of [...neighbors[i]].sort((a, b) => a - b)) {
        if (depth.has(j)) continue
        depth.set(j, depth.get(i) + 1)
        parents.set(j, i)
        q.push(j)
      }
  }
  flood(roots)
  while (g.members.some((i) => !depth.has(i))) {
    const candidate = g.members
      .filter((i) => !depth.has(i))
      .sort((a, b) => neighbors[b].size - neighbors[a].size || a - b)[0]
    if (candidate === undefined) break
    syntheticRoots.push(candidate)
    roots.push(candidate)
    flood([candidate])
  }
  const levels = seq(Math.max(...g.members.map((i) => depth.get(i))) + 1)
  let order = levels.map((level) => g.members.filter((i) => depth.get(i) === level))
  const internal = links.filter((l) => l.ga === gi && l.gb === gi)
  function arrange(orders) {
    const bands = orders.map((xs) => partition(xs, g.w - 48))
    const heights = bands.map((b) => b.rows.length * 48 + (b.rows.length - 1) * 12)
    const height = heights.reduce((a, b) => a + b, 0) + 20 * (bands.length - 1)
    if (height > g.h - 68 + 1e-6) return null
    const result = new Map()
    let top = g.y - g.h / 2 + 44 + (g.h - 68 - height) / 2
    const rowsReport = []
    for (const [level, band] of bands.entries()) {
      for (const [rowIndex, row] of band.rows.entries()) {
        let x = g.x - band.widths[rowIndex] / 2
        const y = top + 24 + rowIndex * 60
        for (const i of row) {
          result.set(i, { x: x + nodes[i].w / 2, y })
          x += nodes[i].w + 18
        }
        rowsReport.push({ level, row: rowIndex, nodeIds: row.map((i) => nodes[i].id), y })
      }
      top += heights[level] + 20
    }
    let cost = 0
    for (const l of internal) {
      const a = result.get(l.a),
        b = result.get(l.b)
      cost += Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
    }
    for (const t of external) {
      const p = result.get(t.node)
      cost += 0.25 * (Math.abs(p.x - t.x) + Math.abs(p.y - t.y))
    }
    return { result, cost, rowsReport, height }
  }
  let best = arrange(order)
  if (!best) throw new Error(`Hierarchy cannot fit frozen frame: ${g.label}`)
  // Horizontal ordering only; explicit depth bands cannot be optimized away.
  for (const _sweep of seq(2))
    for (const level of levels) {
      for (const candidate of permutations(order[level])) {
        const trial = order.map((row, i) => (i === level ? candidate : row))
        const placed = arrange(trial)
        if (placed && placed.cost < best.cost - 1e-6) {
          best = placed
          order = trial
        }
      }
    }
  for (const [i, p] of best.result)
    Object.assign(nodes[i], p, {
      localX: p.x - g.x,
      localY: p.y - g.y,
      depth: depth.get(i),
      parentNode: parents.has(i) ? nodes[parents.get(i)].id : null,
    })
  hierarchies.push({
    groupId: g.id,
    roots: roots.map((i) => nodes[i].id),
    fallbackRoots: syntheticRoots.map((i) => nodes[i].id),
    levels: order.map((row) => row.map((i) => nodes[i].id)),
    rows: best.rowsReport,
    height: best.height,
    note: 'Depth from all external attachments (Internet override). Same-depth siblings may wrap within a band.',
  })
}
function hits(A, B, R) {
  if (Math.abs(A.x - B.x) < 1e-8)
    return (
      A.x > R.left + 1e-6 &&
      A.x < R.right - 1e-6 &&
      Math.max(A.y, B.y) > R.top + 1e-6 &&
      Math.min(A.y, B.y) < R.bottom - 1e-6
    )
  if (Math.abs(A.y - B.y) < 1e-8)
    return (
      A.y > R.top + 1e-6 &&
      A.y < R.bottom - 1e-6 &&
      Math.max(A.x, B.x) > R.left + 1e-6 &&
      Math.min(A.x, B.x) < R.right - 1e-6
    )
  throw new Error('Interior segment is not orthogonal')
}
const obstacles = nodes.map((n) => ({
  left: n.x - n.w / 2 - 5,
  right: n.x + n.w / 2 + 5,
  top: n.y - n.h / 2 - 5,
  bottom: n.y + n.h / 2 + 5,
}))
// Small rectilinear visibility grid per internal path; stays inside the frozen group.
function routeInside(gi, A, B) {
  const g = groups[gi],
    obs = g.members.map((i) => obstacles[i])
  const xs = [
    ...new Set([
      A.x,
      B.x,
      g.x - g.w / 2 + 6,
      g.x + g.w / 2 - 6,
      ...obs.flatMap((o) => [o.left, o.right]),
    ]),
  ].sort((a, b) => a - b)
  const ys = [
    ...new Set([
      A.y,
      B.y,
      g.y - g.h / 2 + 30,
      g.y + g.h / 2 - 6,
      ...obs.flatMap((o) => [o.top, o.bottom]),
    ]),
  ].sort((a, b) => a - b)
  const points = [],
    ids = new Map()
  for (const [yi, y] of ys.entries())
    for (const [xi, x] of xs.entries()) {
      if (
        x < g.x - g.w / 2 - 1e-6 ||
        x > g.x + g.w / 2 + 1e-6 ||
        y < g.y - g.h / 2 - 1e-6 ||
        y > g.y + g.h / 2 + 1e-6
      )
        continue
      if (
        obs.some(
          (o) => x > o.left + 1e-6 && x < o.right - 1e-6 && y > o.top + 1e-6 && y < o.bottom - 1e-6,
        )
      )
        continue
      ids.set(`${xi}:${yi}`, points.length)
      points.push({ x, y, xi, yi })
    }
  const adj = points.map(() => [])
  for (const [i, p] of points.entries()) {
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
    ]) {
      const j = ids.get(`${p.xi + dx}:${p.yi + dy}`)
      if (j === undefined || obs.some((o) => hits(p, points[j], o))) continue
      const w = Math.abs(p.x - points[j].x) + Math.abs(p.y - points[j].y)
      adj[i].push({ j, w })
      adj[j].push({ j: i, w })
    }
  }
  const start = points.findIndex((p) => Math.abs(p.x - A.x) < 1e-7 && Math.abs(p.y - A.y) < 1e-7)
  const end = points.findIndex((p) => Math.abs(p.x - B.x) < 1e-7 && Math.abs(p.y - B.y) < 1e-7)
  if (start < 0 || end < 0) throw new Error(`Missing internal endpoint ${g.label}`)
  const dist = new Float64Array(points.length).fill(Infinity),
    prev = new Int32Array(points.length).fill(-1),
    seen = new Uint8Array(points.length)
  dist[start] = 0
  for (const _it of seq(points.length)) {
    let cur = -1
    for (const i of seq(points.length)) if (!seen[i] && (cur < 0 || dist[i] < dist[cur])) cur = i
    if (cur < 0 || !Number.isFinite(dist[cur])) break
    if (cur === end) {
      const path = []
      let cursor = end
      while (cursor >= 0) {
        path.push({ x: points[cursor].x, y: points[cursor].y })
        cursor = prev[cursor]
      }
      return simplify(path.reverse())
    }
    seen[cur] = 1
    for (const { j, w } of adj[cur])
      if (dist[cur] + w < dist[j]) {
        dist[j] = dist[cur] + w
        prev[j] = cur
      }
  }
  throw new Error(`No interior route: ${g.label}`)
}
function simplify(points) {
  const result = []
  for (const p of points) {
    const last = result[result.length - 1]
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < 1e-7) continue
    while (result.length > 1) {
      const a = result[result.length - 2],
        b = result[result.length - 1]
      if (
        (Math.abs(a.x - b.x) < 1e-7 && Math.abs(b.x - p.x) < 1e-7) ||
        (Math.abs(a.y - b.y) < 1e-7 && Math.abs(b.y - p.y) < 1e-7)
      )
        result.pop()
      else break
    }
    result.push(p)
  }
  return result
}
function attachment(i, toward, vertical = false) {
  const n = nodes[i],
    dx = toward.x - n.x,
    dy = toward.y - n.y
  let nx = 0,
    ny = 0
  if (vertical) ny = dy >= 0 ? 1 : -1
  else if (Math.abs(dx) / n.w > Math.abs(dy) / n.h) nx = dx >= 0 ? 1 : -1
  else ny = dy >= 0 ? 1 : -1
  const edge = { x: n.x + (nx * n.w) / 2, y: n.y + (ny * n.h) / 2 }
  return { edge, stub: { x: edge.x + nx * 5, y: edge.y + ny * 5 } }
}
const terminalByKey = new Map(terminals.map((t) => [`${t.li}:${t.end}`, t]))
const routes = links.map((l, li) => {
  if (l.ga === l.gb) {
    const tree = parents.get(l.a) === l.b || parents.get(l.b) === l.a
    const a = attachment(l.a, nodes[l.b], depth.get(l.a) !== depth.get(l.b))
    const b = attachment(l.b, nodes[l.a], depth.get(l.a) !== depth.get(l.b))
    const inside = [a.edge, ...routeInside(l.ga, a.stub, b.stub), b.edge]
    return {
      ...l,
      points: inside,
      insideA: inside,
      insideB: [],
      kind: tree ? 'tree' : depth.get(l.a) === depth.get(l.b) ? 'same-level' : 'alternate',
    }
  }
  const A = terminalByKey.get(`${li}:a`),
    B = terminalByKey.get(`${li}:b`)
  if (!A || !B) throw new Error('Missing terminal')
  const a = attachment(l.a, A),
    b = attachment(l.b, B)
  const insideA = [a.edge, ...routeInside(l.ga, a.stub, A)]
  const insideB = [...routeInside(l.gb, B, b.stub), b.edge]
  const exterior = l.points.slice(1, -1)
  // Preserve every old exterior waypoint, including exact boundary terminals.
  return {
    ...l,
    points: [...insideA, ...exterior.slice(1, -1), ...insideB],
    insideA,
    insideB,
    exterior,
    kind: 'external',
  }
})
const checks = {
  nodeOverlaps: 0,
  outside: 0,
  parentNotAboveChild: 0,
  interiorNodePiercings: 0,
  nonOrthogonalInteriorSegments: 0,
  exteriorChanges: 0,
}
for (const [i, n] of nodes.entries()) {
  const g = groups[groupOf.get(i)]
  if (
    Math.abs(n.x - g.x) + n.w / 2 > g.w / 2 + 1e-6 ||
    Math.abs(n.y - g.y) + n.h / 2 > g.h / 2 + 1e-6
  )
    checks.outside++
  if (parents.has(i) && nodes[parents.get(i)].y + nodes[parents.get(i)].h / 2 >= n.y - n.h / 2)
    checks.parentNotAboveChild++
  for (const j of seq(i))
    if (
      Math.abs(n.x - nodes[j].x) < (n.w + nodes[j].w) / 2 - 1e-6 &&
      Math.abs(n.y - nodes[j].y) < (n.h + nodes[j].h) / 2 - 1e-6
    )
      checks.nodeOverlaps++
}
for (const [li, r] of routes.entries()) {
  if (
    r.kind === 'external' &&
    JSON.stringify(r.exterior) !== JSON.stringify(links[li].points.slice(1, -1))
  )
    checks.exteriorChanges++
  for (const path of [r.insideA, r.insideB])
    for (const [j, p] of path.entries()) {
      if (j === 0) continue
      const q = path[j - 1]
      if (Math.abs(p.x - q.x) > 1e-6 && Math.abs(p.y - q.y) > 1e-6) {
        checks.nonOrthogonalInteriorSegments++
        continue
      }
      for (const [i, n] of nodes.entries()) {
        if (i === r.a || i === r.b) continue
        if (
          hits(q, p, {
            left: n.x - n.w / 2,
            right: n.x + n.w / 2,
            top: n.y - n.h / 2,
            bottom: n.y + n.h / 2,
          })
        )
          checks.interiorNodePiercings++
      }
    }
}
if (fixedGeometry !== JSON.stringify({ groups, terminals }))
  throw new Error('Frozen external geometry changed')
if (Object.values(checks).some((v) => v !== 0)) throw new Error(JSON.stringify(checks))
const xml = (s) =>
  String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
const palette = ['#3e7c91', '#936844', '#5e7d57', '#846da6', '#397b74', '#977542', '#546dae']
function svg(selection = null, showLinks = true) {
  const selected = selection === null ? seq(groups.length) : selection
  const selectedSet = new Set(selected),
    bs = selected.map((i) => groups[i])
  const minX = Math.min(...bs.map((b) => b.x - b.w / 2)) - 32,
    maxX = Math.max(...bs.map((b) => b.x + b.w / 2)) + 32
  const minY = Math.min(...bs.map((b) => b.y - b.h / 2)) - 70,
    maxY = Math.max(...bs.map((b) => b.y + b.h / 2)) + 32
  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${[minX, minY, maxX - minX, maxY - minY].join(' ')}" font-family="Segoe UI, sans-serif">`,
    `<rect x="${minX}" y="${minY}" width="${maxX - minX}" height="${maxY - minY}" fill="#f7f9fc"/>`,
    `<text x="${minX + 16}" y="${minY + 30}" font-size="${selection === null ? 24 : 17}" fill="#18334d">V7 · polar subgraphs / hierarchical interiors</text>`,
    `<text x="${minX + 16}" y="${minY + 50}" font-size="11" fill="#5e7389">Fixed frames and terminals · roots above descendants · same-depth siblings may wrap</text>`,
  ]
  for (const gi of selected) {
    const g = groups[gi],
      color = palette[gi % palette.length]
    out.push(
      `<rect x="${g.x - g.w / 2}" y="${g.y - g.h / 2}" width="${g.w}" height="${g.h}" fill="${color}" fill-opacity="0.04" stroke="${color}" stroke-opacity="0.6"/>`,
    )
    out.push(
      `<text x="${g.x - g.w / 2 + 12}" y="${g.y - g.h / 2 + 22}" font-size="13" fill="${color}">${xml(g.label)}</text>`,
    )
  }
  if (showLinks)
    for (const r of routes) {
      const paths =
        selection === null
          ? [r.points]
          : r.kind === 'external'
            ? [
                ...(selectedSet.has(r.ga) ? [r.insideA] : []),
                ...(selectedSet.has(r.gb) ? [r.insideB] : []),
              ]
            : selectedSet.has(r.ga)
              ? [r.points]
              : []
      for (const path of paths) {
        const extra = r.kind === 'same-level' || r.kind === 'alternate'
        out.push(
          '<path data-link="' +
            xml(r.id) +
            '" d="' +
            path.map((p, i) => `${(i ? 'L ' : 'M ') + p.x} ${p.y}`).join(' ') +
            '" fill="none" stroke="' +
            (r.role === 'floor-peer'
              ? '#bf7134'
              : extra
                ? '#8492a1'
                : r.kind === 'tree'
                  ? '#326e98'
                  : '#526d87') +
            '" stroke-opacity="' +
            (r.kind === 'tree' ? 0.85 : 0.42) +
            '" stroke-width="' +
            (r.kind === 'tree' ? 1.5 : 1.1) +
            '" ' +
            (extra || r.role === 'floor-peer' ? 'stroke-dasharray="5 4"' : '') +
            '/>',
        )
      }
    }
  for (const t of terminals)
    if (selectedSet.has(t.g))
      out.push(
        `<circle cx="${t.x}" cy="${t.y}" r="3.1" fill="#fff" stroke="#b65c22" stroke-width="1.2"/>`,
      )
  for (const [i, n] of nodes.entries())
    if (selectedSet.has(groupOf.get(i))) {
      const ap = n.role === 'wireless-ap',
        poe = n.role === 'floor-poe-switch'
      out.push(
        '<g data-node="' +
          xml(n.id) +
          '"><rect x="' +
          (n.x - n.w / 2) +
          '" y="' +
          (n.y - n.h / 2) +
          '" width="' +
          n.w +
          '" height="' +
          n.h +
          '" rx="' +
          (ap ? 15 : 7) +
          '" fill="' +
          (poe ? '#e1f1eb' : ap ? '#edf4ff' : '#fff') +
          '" stroke="#8a9cb1"/>' +
          '<text x="' +
          n.x +
          '" y="' +
          (n.y - 1) +
          '" font-size="12" text-anchor="middle" fill="#19334e">' +
          xml(n.label) +
          '</text>' +
          '<text x="' +
          n.x +
          '" y="' +
          (n.y + 14) +
          '" font-size="9" text-anchor="middle" fill="#697d91">' +
          xml(n.role) +
          '</text></g>',
      )
    }
  return `${out.join('\n')}</svg>`
}
await Bun.write(`${outputBase}.svg`, svg())
await Bun.write(`${outputBase}-only.svg`, svg(null, false))
const detail = groups.findIndex((g) => g.id === 'test:area:hall-east')
if (detail < 0) throw new Error('Missing detail group')
await Bun.write(`${outputBase}-detail.svg`, svg([detail]))
await Bun.write(
  `${outputBase}-report.json`,
  JSON.stringify(
    {
      inputPath: baseline.inputPath,
      inputHash: baseline.inputHash,
      baselinePath,
      counts: baseline.counts,
      checks,
      externalGeometryExactlyPreserved: true,
      assumptions: [
        'All externally attached members seed a multi-source internal BFS; Internet overrides seeds in its group.',
        'Direction is a display hierarchy, not inferred physical traffic direction or role tiers.',
        'Disconnected interior components without terminals use a highest-internal-degree display root.',
        'Depth bands top-to-bottom; same-depth siblings wrap to fit the frozen frame without resizing nodes.',
        'Enumerate horizontal order within each level; retain every original link, including non-tree links.',
        'Only internal polylines change. All external waypoints, frames and terminals are copied exactly.',
      ],
      groups,
      terminals,
      nodes,
      links: routes,
      hierarchies,
    },
    null,
    2,
  ),
)
console.log(
  JSON.stringify(
    {
      checks,
      counts: baseline.counts,
      treeLinks: routes.filter((r) => r.kind === 'tree').length,
      nonTreeInternalLinks: routes.filter((r) => r.kind === 'same-level' || r.kind === 'alternate')
        .length,
    },
    null,
    2,
  ),
)
