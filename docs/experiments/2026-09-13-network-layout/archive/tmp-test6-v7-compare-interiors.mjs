import { createRequire } from 'node:module'
import { interiorMetrics } from './tmp-test6-v7-interior-objective.mjs'

const require = createRequire(
  new URL('../../../../libs/@shumoku/renderer-png/package.json', import.meta.url),
)
const { Resvg } = require('@resvg/resvg-js')
const names = ['tmp-test6-v7-internet-upstream', 'tmp-test6-v7-rooted-interior-refined']
const reports = await Promise.all(names.map((n) => Bun.file(`${n}-report.json`).json()))
const svgs = await Promise.all(names.map((n) => Bun.file(`${n}.svg`).text()))
const measurements = reports.map((r) =>
  interiorMetrics(r.nodes, r.groups, r.links, r.nodes, r.terminals),
)
const labels = ['Before: boundary-connected roots', 'After: Internet-rooted depths']
const samples = ['NOC#N-6', 'NOC#D-2']
const cells = samples.map((label) =>
  reports.map((r) => {
    const g = r.groups.find((g) => g.label === label)
    if (!g) throw new Error(`Missing ${label}`)
    return g
  }),
)
const width = Math.max(...cells.flat().map((g) => g.w)) + 48
let y = 55
const parts = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${2 * width + 60} HEIGHT" font-family="Segoe UI,sans-serif">`,
]
parts.push(`<rect width="100%" height="100%" fill="#f5f8fc"/>`)
for (const [col, label] of labels.entries())
  parts.push(
    `<text x="${20 + col * (width + 20)}" y="30" font-size="19" fill="#18334d">${label}</text>`,
  )
for (const row of cells) {
  const height = Math.max(...row.map((g) => g.h)) + 48
  for (const [col, g] of row.entries()) {
    const x = 20 + col * (width + 20)
    const viewBox = [g.x - width / 2, g.y - height / 2, width, height].join(' ')
    // Crops retain the original geometry and all crossing wires visible in the crop.
    const nested = svgs[col].replace(
      /<svg[^>]*>/,
      `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${viewBox}">`,
    )
    parts.push(nested)
  }
  y += height + 25
}
parts.push('</svg>')
const svg = parts.join('\n').replace('HEIGHT', String(y))
await Bun.write('tmp-test6-v7-interior-comparison.svg', svg)
await Bun.write(
  'tmp-test6-v7-interior-comparison.png',
  new Resvg(svg, { fitTo: { mode: 'width', value: 2400 } }).render().asPng(),
)
const comparison = {
  before: measurements[0],
  after: measurements[1],
  depthChanges: reports[1].nodes
    .filter((n, i) => n.depth !== reports[0].nodes[i].depth)
    .map((n) => ({ id: n.id, depth: n.depth, rootDistance: n.rootDistance })),
  dimensions: reports[1].groups.flatMap((g, i) => {
    const old = reports[0].groups[i]
    return old.w === g.w && old.h === g.h
      ? []
      : [{ id: g.id, label: g.label, before: [old.w, old.h], after: [g.w, g.h] }]
  }),
}
await Bun.write('tmp-test6-v7-interior-comparison.json', JSON.stringify(comparison, null, 2))
console.log(
  JSON.stringify({
    before: { ...measurements[0], groups: undefined },
    after: { ...measurements[1], groups: undefined },
    depthChanges: comparison.depthChanges.length,
    dimensions: comparison.dimensions,
  }),
)
