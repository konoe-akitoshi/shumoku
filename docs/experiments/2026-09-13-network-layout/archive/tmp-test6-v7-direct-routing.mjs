import { createRequire } from 'node:module'
import { routeBoundaryConnections, segmentHits } from './tmp-test6-v7-boundary-routing.mjs'
import { connectionMetrics } from './tmp-test6-v7-boundary-search.mjs'

const require = createRequire(
  new URL('../../../../libs/@shumoku/renderer-png/package.json', import.meta.url),
)
const { Resvg } = require('@resvg/resvg-js')
const source = 'tmp-test6-v7-free-groups'
const output = 'tmp-test6-v7-direct-routing'
const baseline = await Bun.file(`${source}-report.json`).json()
const { nodes, groups, terminals, links } = baseline
const routes = routeBoundaryConnections({ nodes, groups, terminals, links, positions: nodes })
const newLinks = links.map((l, i) => ({ ...l, ...routes[i] }))
const rectangles = groups.map((g) => ({
  left: g.x - g.w / 2,
  right: g.x + g.w / 2,
  top: g.y - g.h / 2,
  bottom: g.y + g.h / 2,
}))
const length = (ps) =>
  ps.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - ps[i].x, p.y - ps[i].y), 0)
const checks = { framePiercings: 0, clearButBent: 0, longerRoutes: 0, missingBoundary: 0 }
let clearConnections = 0,
  previousClearButBent = 0
for (const [i, r] of routes.entries()) {
  if (!r.crossGroup) continue
  const ps = r.points.slice(1, -1)
  if (
    JSON.stringify(ps[0]) !== JSON.stringify(r.exit) ||
    JSON.stringify(ps.at(-1)) !== JSON.stringify(r.entry)
  )
    checks.missingBoundary++
  for (const [j, p] of ps.entries())
    if (j)
      for (const rect of rectangles) if (segmentHits(ps[j - 1], p, rect)) checks.framePiercings++
  const clear = !rectangles.some((rect) => segmentHits(r.exit, r.entry, rect))
  if (clear) {
    clearConnections++
    if (ps.length !== 2) checks.clearButBent++
    if (length(links[i].points.slice(1, -1)) > length([r.exit, r.entry]) + 0.01)
      previousClearButBent++
  }
  if (length(r.points) > length(links[i].points) + 1e-6) checks.longerRoutes++
}
if (Object.values(checks).some((v) => v !== 0)) throw new Error(JSON.stringify(checks))
const escapeXml = (s) =>
  String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
const lookup = new Map(routes.map((r) => [escapeXml(r.id), r]))
const oldSvg = await Bun.file(`${source}.svg`).text()
let replaced = 0
const svg = oldSvg
  .replace(
    'Free group placement / Internet-rooted interiors',
    'Direct boundary routing / unchanged placement',
  )
  .replace(/<path data-link="([^"]*)" d="[^"]*"/g, (_, id) => {
    const r = lookup.get(id)
    if (!r) throw new Error(`Unknown SVG link ${id}`)
    replaced++
    return `<path data-link="${id}" d="${r.points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')}"`
  })
if (replaced !== links.length) throw new Error('Not all SVG links replaced')
await Bun.write(`${output}.svg`, svg)
await Bun.write(
  `${output}.png`,
  new Resvg(svg, { fitTo: { mode: 'width', value: 2800 } }).render().asPng(),
)
const report = {
  version: 7,
  placementSource: `${source}-report.json`,
  inputPath: baseline.inputPath,
  inputHash: baseline.inputHash,
  counts: baseline.counts,
  nodes,
  groups,
  terminals,
  links: newLinks,
  routing: {
    model:
      'Shortest visible path between exact boundary terminals, avoiding actual frame interiors. No normal stubs, obstacle inflation, or bend penalty. Placement and boundary terminals are unchanged.',
    clearConnections,
    previousClearButBent,
    checks,
    before: connectionMetrics(links, nodes, terminals, links),
    after: connectionMetrics(newLinks, nodes, terminals, newLinks),
  },
}
await Bun.write(`${output}-report.json`, JSON.stringify(report, null, 2))
const sample = links.find((l) => l.id === 'zabbix:link:6')
if (!sample) throw new Error('Missing comparison sample')
const boxes = [groups[sample.ga], groups[sample.gb]]
const x = Math.min(...boxes.map((g) => g.x - g.w / 2)) - 24,
  y = Math.min(...boxes.map((g) => g.y - g.h / 2)) - 24
const w = Math.max(...boxes.map((g) => g.x + g.w / 2)) - x + 24,
  h = Math.max(...boxes.map((g) => g.y + g.h / 2)) - y + 24
const panels = [oldSvg, svg].map((s, i) =>
  s.replace(
    /<svg[^>]*>/,
    `<svg x="${i * (w + 24)}" y="38" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}">`,
  ),
)
const comparison = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w * 2 + 24} ${h + 38}" font-family="Segoe UI,sans-serif"><rect width="100%" height="100%" fill="#f7f9fc"/><text x="12" y="24" fill="#18334d" font-size="18">Before: forced 10px stubs</text><text x="${w + 36}" y="24" fill="#18334d" font-size="18">After: direct boundary paths</text>${panels.join('')}</svg>`
await Bun.write(`${output}-comparison.svg`, comparison)
await Bun.write(
  `${output}-comparison.png`,
  new Resvg(comparison, { fitTo: { mode: 'width', value: 2200 } }).render().asPng(),
)
console.log(JSON.stringify(report.routing, null, 2))
