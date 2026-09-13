import { createRequire } from 'node:module'
import { connectionHalos } from './tmp-test6-v8-connection-halo.mjs'
import { layoutDependencyY } from './tmp-test6-v8-dependency-y.mjs'
import { layoutDistributedPorts } from './tmp-test6-v8-distributed-ports.mjs'
import { optimizeElasticFrames } from './tmp-test6-v8-elastic-frames.mjs'
import { haloOverlapPairs } from './tmp-test6-v8-hard-halo.mjs'
import { layoutVirtualRows } from './tmp-test6-v8-virtual-rows.mjs'
import { layoutWireChannels } from './tmp-test6-v8-wire-channels.mjs'

const require = createRequire(
  new URL('../../../../libs/@shumoku/renderer-png/package.json', import.meta.url),
)
const { Resvg } = require('@resvg/resvg-js')
const hardHalos = process.argv.includes('--hard-halo')
const dependencyY = process.argv.includes('--dependency-y')
if (
  dependencyY &&
  process.argv.slice(2).some((a) => !['--dependency-y', '--render-report'].includes(a))
)
  throw new Error(
    'Dependency Y uses saved distributed-port settings; do not combine layout modes or parameter overrides',
  )
const distributedPorts = process.argv.includes('--distributed-ports')
const wireChannels = process.argv.includes('--wire-channels') || distributedPorts
const wireClearanceScale = Number(
  process.argv.find((a) => a.startsWith('--wire-clearance-scale='))?.split('=')[1] ??
    (distributedPorts ? 1.5 : 1),
)
if (!Number.isFinite(wireClearanceScale) || wireClearanceScale <= 0)
  throw new Error('Expected positive wire clearance scale')
if (!wireChannels && process.argv.some((a) => a.startsWith('--wire-clearance-scale=')))
  throw new Error('Use --wire-channels with --wire-clearance-scale')
const virtualRows = process.argv.includes('--virtual-rows') || wireChannels
const connectionAware = process.argv.includes('--connection-halo') || hardHalos
const areaHalo = process.argv.includes('--area-halo') || connectionAware
const areaRatio = Number(
  process.argv.find((a) => a.startsWith('--area-ratio='))?.split('=')[1] ?? 0.1,
)
if (!Number.isFinite(areaRatio) || areaRatio <= 0) throw new Error('Expected positive area ratio')
const source = dependencyY
    ? 'tmp-test6-v8-distributed-ports'
    : wireChannels
      ? 'tmp-test6-v8-virtual-rows-area-15'
      : virtualRows
        ? 'tmp-test6-v8-hard-halo'
        : hardHalos
          ? 'tmp-test6-v8-connection-halo'
          : connectionAware
            ? 'tmp-test6-v8-area-halo'
            : areaHalo
              ? 'tmp-test6-v8-elastic-frames'
              : 'tmp-test6-v8-dynamic-avoidance',
  output = dependencyY
    ? 'tmp-test6-v8-dependency-y'
    : distributedPorts
      ? `tmp-test6-v8-distributed-ports${wireClearanceScale === 1.5 ? '' : `-clearance-${wireClearanceScale}`}`
      : wireChannels
        ? `tmp-test6-v8-wire-channels${wireClearanceScale === 1 ? '' : `-clearance-${wireClearanceScale}`}`
        : virtualRows
          ? `tmp-test6-v8-virtual-rows${areaRatio === 0.1 ? '' : `-area-${areaRatio * 100}`}`
          : hardHalos
            ? 'tmp-test6-v8-hard-halo'
            : connectionAware
              ? 'tmp-test6-v8-connection-halo'
              : areaHalo
                ? 'tmp-test6-v8-area-halo'
                : 'tmp-test6-v8-elastic-frames'
const baseline = await Bun.file(`${source}-report.json`).json()
if (wireChannels && process.argv.some((a) => a.startsWith('--area-ratio=')))
  throw new Error('Wire channels retain the source area ratio; omit --area-ratio')
const comparisonSource = distributedPorts
  ? 'tmp-test6-v8-wire-channels-clearance-1.5'
  : wireChannels && wireClearanceScale !== 1
    ? 'tmp-test6-v8-wire-channels'
    : !wireChannels && virtualRows && areaRatio !== 0.1
      ? 'tmp-test6-v8-virtual-rows'
      : source
const comparisonBaseline =
  comparisonSource === source ? baseline : await Bun.file(`${comparisonSource}-report.json`).json()
const display = await Bun.file('tmp-test6-v8-side-centers-report.json').json()
const template = await Bun.file('tmp-test6-v8-side-centers.svg').text()
const oldSvg = await Bun.file(`${comparisonSource}.svg`).text()
const savedReport = process.argv.includes('--render-report')
  ? await Bun.file(`${output}-report.json`).json()
  : null
const result = savedReport
  ? { ...savedReport, ...savedReport.avoidance, metrics: savedReport.avoidance.after }
  : dependencyY
    ? layoutDependencyY(baseline)
    : distributedPorts
      ? layoutDistributedPorts(baseline, { wireClearanceScale })
      : wireChannels
        ? layoutWireChannels(baseline, { wireClearanceScale })
        : virtualRows
          ? layoutVirtualRows(baseline, display, { areaRatio })
          : optimizeElasticFrames(
              baseline,
              display,
              template,
              areaHalo ? { areaRatio, connectionAware, hardHalos } : {},
            )
const escapeXml = (s) =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
const frameTemplates = [
  ...template.matchAll(/<rect[^>]*fill-opacity="0.04"[^>]*\/>\s*<text[^>]*>[\s\S]*?<\/text>/g),
].map((m) => m[0])
const nodeTemplates = [...template.matchAll(/<g data-node="([^"]*)">[\s\S]*?<\/g>/g)]
const linkTemplates = [...template.matchAll(/<path data-link="([^"]*)"[^>]*\/>/g)]
if (
  frameTemplates.length !== result.groups.length ||
  nodeTemplates.length !== result.nodes.length ||
  linkTemplates.length !== result.links.length
)
  throw new Error('Missing SVG elements')
const bounds = (groups) => ({
  left: Math.min(...groups.map((g) => g.x - g.w / 2)),
  right: Math.max(...groups.map((g) => g.x + g.w / 2)),
  top: Math.min(...groups.map((g) => g.y - g.h / 2)),
  bottom: Math.max(...groups.map((g) => g.y + g.h / 2)),
})
const b = bounds(result.groups),
  x = b.left - 60,
  y = b.top - 100,
  w = b.right - b.left + 120,
  h = b.bottom - b.top + 160
const frames = result.groups.map((g, i) => {
  const old = display.groups[i]
  const dx = g.x - g.w / 2 - (old.x - old.w / 2),
    dy = g.y - g.h / 2 - (old.y - old.h / 2)
  return frameTemplates[i]
    .replace(/<rect[^>]*\/>/, (s) =>
      s
        .replace(/x="[^"]*"/, `x="${g.x - g.w / 2}"`)
        .replace(/y="[^"]*"/, `y="${g.y - g.h / 2}"`)
        .replace(/width="[^"]*"/, `width="${g.w}"`)
        .replace(/height="[^"]*"/, `height="${g.h}"`),
    )
    .replace(/<text /, `<text transform="translate(${dx} ${dy})" `)
})
const linkMap = new Map(result.links.map((l) => [escapeXml(l.id), l]))
const paths = linkTemplates.map((m) => {
  const l = linkMap.get(m[1])
  if (!l) throw new Error('Missing link')
  return m[0].replace(
    / d="[^"]*"/,
    ` d="${l.points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')}"`,
  )
})
const nodes = nodeTemplates.map((m, i) => {
  if (escapeXml(result.nodes[i].id) !== m[1]) throw new Error('Node order changed')
  return m[0].replace(
    '<g ',
    `<g transform="translate(${result.nodes[i].x - display.nodes[i].x} ${result.nodes[i].y - display.nodes[i].y})" `,
  )
})
const terminals = result.terminals.map(
  (t) =>
    `<circle cx="${t.x}" cy="${t.y}" r="3.1" fill="#fff" stroke="#b65c22" stroke-width="1.3"><title>${escapeXml(result.links[t.li].id)} ${t.end}</title></circle>`,
)
const renderedRatio = result.options.areaRatio ?? areaRatio
const title = dependencyY
  ? 'Independent node Y / dependency and wire optimization'
  : distributedPorts
    ? 'Distributed node attachments / wire-owned spacing'
    : wireChannels
      ? `Wire-owned channels / clearance x${result.options.wireClearanceScale ?? 1} / rigid rows`
      : virtualRows
        ? `Dependency rows / virtual wire slots / base area ${renderedRatio * 100}%`
        : hardHalos
          ? `Required directional bands (base ${renderedRatio * 100}%) / feasible layouts only`
          : connectionAware
            ? `Connection-weighted directional bands (base ${renderedRatio * 100}%)`
            : areaHalo
              ? `Area-based outer bands (${renderedRatio * 100}%) / soft spacing`
              : 'Elastic frames and fully recomputed routes'
const subtitle = dependencyY
  ? 'No same-Y constraint or row attraction / fixed X and track order / hard clearance'
  : distributedPorts
    ? 'Center-derived directions → spaced edge attachments → wire channels → rigid dependency rows'
    : wireChannels
      ? 'Local overlapping spans → wire lanes → required gap capacity → whole-group separation'
      : virtualRows
        ? 'Real nodes + wire slots → one row per depth → whole-group separation → boundary routing'
        : 'Measured node moves → content-sized frames → group separation → boundary terminals → routing'
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" font-family="Segoe UI, sans-serif"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#f7f9fc"/><text x="${x + 20}" y="${y + 35}" font-size="24" fill="#18334d">V8 · ${title} · 89 nodes / 160 links</text><text x="${x + 20}" y="${y + 60}" font-size="14" fill="#52667a">${subtitle}</text>${frames.join('\n')}${paths.join('\n')}${nodes.join('\n')}${terminals.join('\n')}</svg>`
const resized = result.groups.flatMap((g, i) => {
  const a = comparisonBaseline.groups[i]
  return Math.abs(g.w - a.w) + Math.abs(g.h - a.h) > 1e-6
    ? [{ id: g.id, before: { w: a.w, h: a.h }, after: { w: g.w, h: g.h } }]
    : []
})
const avoidance = {
  model: result.model,
  options: result.options,
  before: comparisonSource !== source ? comparisonBaseline.avoidance.after : result.before,
  rebuiltInitial: result.rebuiltInitial,
  after: result.metrics,
  moved: result.moved,
  resized,
  trace: result.trace,
  evaluations: result.evaluations,
  ...(result.haloProfiles ? { haloProfiles: result.haloProfiles } : {}),
  ...(hardHalos ? { haloRejected: result.haloRejected } : {}),
}
const report = {
  version: 8,
  placementSource: `${source}-report.json`,
  comparisonSource: `${comparisonSource}-report.json`,
  displaySource: 'tmp-test6-v8-side-centers-report.json',
  inputPath: baseline.inputPath,
  inputHash: baseline.inputHash,
  counts: baseline.counts,
  groups: result.groups,
  terminals: result.terminals,
  nodes: result.nodes,
  links: result.links,
  ...(virtualRows ? { virtualNodes: result.virtualNodes, rows: result.rows } : {}),
  ...(wireChannels ? { wireChannels: result.wireChannels } : {}),
  ...(distributedPorts ? { nodePorts: result.nodePorts, portRepairs: result.portRepairs } : {}),
  ...(dependencyY
    ? {
        virtualNodes: result.virtualNodes,
        nodePorts: result.nodePorts,
        dependencyOptimization: result.dependencyOptimization,
        upstream: result.upstream,
      }
    : {}),
  avoidance,
}
await Bun.write(`${output}-report.json`, JSON.stringify(report, null, 2))
await Bun.write(`${output}.svg`, svg)
await Bun.write(
  `${output}.png`,
  new Resvg(svg, { fitTo: { mode: 'width', value: 3200 } }).render().asPng(),
)
// Compare the most affected group at the same scale.
const crowded = hardHalos
  ? haloOverlapPairs(
      connectionHalos(
        baseline.nodes,
        baseline.groups,
        baseline.links,
        baseline.terminals,
        result.options.nodeStroke,
        result.options.frameStroke,
        renderedRatio,
      ).groups,
    )
  : []
const gi = comparisonBaseline.groups
  .map((g, i) => ({
    i,
    count: dependencyY
      ? Math.max(
          ...result.dependencyOptimization.rowAudit.filter((r) => r.gi === i).map((r) => r.spread),
        )
      : distributedPorts
        ? Math.max(
            ...result.nodePorts.filter((p) => g.members.includes(p.node)).map((p) => p.count),
          )
        : wireChannels
          ? result.wireChannels
              .filter((c) => c.gi === i)
              .reduce((sum, c) => sum + c.height - c.oldHeight, 0)
          : virtualRows
            ? g.members.reduce(
                (sum, n) =>
                  sum +
                  Math.abs(
                    comparisonBaseline.nodes[n].y - comparisonBaseline.nodes[g.members[0]].y,
                  ),
                0,
              )
            : hardHalos
              ? crowded.filter((p) => p.i === i || p.j === i).length
              : result.before.conflicts.filter(
                  (c) => c.penetration > 0 && g.members.includes(c.node),
                ).length,
  }))
  .sort((a, b) => b.count - a.count)[0].i
const pair = [comparisonBaseline.groups[gi], result.groups[gi]]
const pw = Math.max(...pair.map((g) => g.w)) + 80,
  ph = Math.max(...pair.map((g) => g.h)) + 80
const panels = [oldSvg, svg].map((s, i) =>
  s.replace(
    /<svg[^>]*>/,
    `<svg x="${i * (pw + 24)}" y="42" width="${pw}" height="${ph}" viewBox="${pair[i].x - pw / 2} ${pair[i].y - ph / 2} ${pw} ${ph}">`,
  ),
)
const beforeCaption = dependencyY
  ? 'same Y fixed per depth'
  : distributedPorts
    ? 'shared side midpoint / clearance x1.5'
    : wireChannels
      ? wireClearanceScale !== 1
        ? 'wire clearance x1.0 / node bands 15%'
        : 'node bands 15% / no wire channel capacity'
      : virtualRows
        ? comparisonSource !== source
          ? `virtual rows / base area ${comparisonBaseline.avoidance.options.areaRatio * 100}%`
          : 'individual node displacement'
        : hardHalos
          ? 'soft directional bands'
          : connectionAware
            ? `uniform area bands (${baseline.avoidance.options.areaRatio * 100}%)`
            : areaHalo
              ? 'elastic frames / no spacing objective'
              : 'fixed frames'
const afterCaption = dependencyY
  ? 'independent Y / dependency + wire springs'
  : distributedPorts
    ? `distributed ports / pitch ${result.options.portPitch}px`
    : wireChannels
      ? `wire clearance x${result.options.wireClearanceScale ?? 1} / node bands 15%`
      : virtualRows
        ? `one row per depth / base area ${renderedRatio * 100}%`
        : hardHalos
          ? 'required directional bands'
          : connectionAware
            ? 'connection-weighted / per-side bands'
            : areaHalo
              ? `area-based bands (${renderedRatio * 100}%)`
              : 'elastic frames / rerouted wires'
const comparison = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pw * 2 + 24} ${ph + 42}" font-family="Segoe UI,sans-serif"><rect width="100%" height="100%" fill="#f7f9fc"/><text x="12" y="26" font-size="18" fill="#18334d">Before: ${beforeCaption}</text><text x="${pw + 36}" y="26" font-size="18" fill="#18334d">After: ${afterCaption}</text>${panels.join('')}</svg>`
await Bun.write(`${output}-comparison.svg`, comparison)
await Bun.write(
  `${output}-comparison.png`,
  new Resvg(comparison, { fitTo: { mode: 'width', value: 2400 } }).render().asPng(),
)
console.log(
  JSON.stringify({
    before: { ...avoidance.before, conflicts: undefined },
    rebuiltInitial: { ...result.rebuiltInitial, conflicts: undefined },
    after: { ...result.metrics, conflicts: undefined },
    moved: result.moved.length,
    resized: resized.length,
    maxMove: Math.max(...result.moved.map((m) => m.distance)),
    evaluations: result.evaluations,
  }),
)
