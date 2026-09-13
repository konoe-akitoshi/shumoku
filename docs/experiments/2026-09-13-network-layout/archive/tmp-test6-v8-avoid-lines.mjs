import { createRequire } from 'node:module'
import { optimizeDynamicAvoidance } from './tmp-test6-v8-dynamic-avoidance.mjs'
import { optimizeLineAvoidance } from './tmp-test6-v8-line-avoidance.mjs'

const require = createRequire(
  new URL('../../../../libs/@shumoku/renderer-png/package.json', import.meta.url),
)
const { Resvg } = require('@resvg/resvg-js')
const dynamic = process.argv.includes('--dynamic')
const source = 'tmp-test6-v8-side-centers',
  output = dynamic ? 'tmp-test6-v8-dynamic-avoidance' : 'tmp-test6-v8-avoid-lines'
const baseline = await Bun.file(`${source}-report.json`).json()
const oldSvg = await Bun.file(`${source}.svg`).text()
const result = dynamic
  ? optimizeDynamicAvoidance(baseline, oldSvg)
  : optimizeLineAvoidance(baseline)
const escapeXml = (s) =>
  String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
const routes = new Map(result.links.map((l) => [escapeXml(l.id), l]))
const moves = new Map(result.moved.map((m) => [escapeXml(m.id), m]))
let paths = 0
const svg = oldSvg
  .replace(
    'Node side-center attachments / unchanged placement',
    dynamic ? 'Measured geometry driven node movement' : 'Local node movement away from wires',
  )
  .replace(/<path data-link="([^"]*)" d="[^"]*"/g, (_, id) => {
    const l = routes.get(id)
    if (!l) throw new Error(`Missing link ${id}`)
    paths++
    return `<path data-link="${id}" d="${l.points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')}"`
  })
  .replace(/<g data-node="([^"]*)">/g, (match, id) => {
    const m = moves.get(id)
    return m ? `<g data-node="${id}" transform="translate(${m.dx} ${m.dy})">` : match
  })
if (paths !== baseline.links.length) throw new Error('Lost SVG links')
const avoidance = {
  model:
    result.model ??
    'Local node displacement only. Lexicographic wire/node intersection count, then squared clearance penetration plus displacement penalty. Same-depth row alignment may deviate locally; depth order, frame containment, node separation, Internet anchor and exterior paths remain fixed.',
  options: result.options,
  before: result.before,
  after: result.metrics,
  moved: result.moved,
  trace: result.trace,
  evaluations: result.evaluations,
}
await Bun.write(
  `${output}-report.json`,
  JSON.stringify(
    {
      version: 8,
      placementSource: `${source}-report.json`,
      inputPath: baseline.inputPath,
      inputHash: baseline.inputHash,
      counts: baseline.counts,
      groups: baseline.groups,
      terminals: baseline.terminals,
      nodes: result.nodes,
      links: result.links,
      avoidance,
    },
    null,
    2,
  ),
)
await Bun.write(`${output}.svg`, svg)
await Bun.write(
  `${output}.png`,
  new Resvg(svg, { fitTo: { mode: 'width', value: 2800 } }).render().asPng(),
)
const groups = baseline.groups
const most = groups
  .map((g) => ({
    g,
    count: result.before.conflicts.filter((c) => g.members.includes(c.node) && c.penetration > 0)
      .length,
  }))
  .sort((a, b) => b.count - a.count)[0].g
const w = most.w + 48,
  h = most.h + 48,
  x = most.x - w / 2,
  y = most.y - h / 2
const panels = [oldSvg, svg].map((s, i) =>
  s.replace(
    /<svg[^>]*>/,
    `<svg x="${i * (w + 24)}" y="38" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}">`,
  ),
)
const comparison = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w * 2 + 24} ${h + 38}" font-family="Segoe UI,sans-serif"><rect width="100%" height="100%" fill="#f7f9fc"/><text x="12" y="24" font-size="18" fill="#18334d">Before: fixed node positions</text><text x="${w + 36}" y="24" font-size="18" fill="#18334d">After: local wire avoidance</text>${panels.join('')}</svg>`
await Bun.write(`${output}-comparison.svg`, comparison)
await Bun.write(
  `${output}-comparison.png`,
  new Resvg(comparison, { fitTo: { mode: 'width', value: 2400 } }).render().asPng(),
)
console.log(
  JSON.stringify({
    before: { ...result.before, conflicts: undefined },
    after: { ...result.metrics, conflicts: undefined },
    moved: result.moved.length,
    maxMove: Math.max(...result.moved.map((m) => m.distance)),
    evaluations: result.evaluations,
  }),
)
