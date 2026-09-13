import { fitFrames } from './tmp-test6-v8-elastic-frames.mjs'
import { projectHardHalos } from './tmp-test6-v8-hard-halo.mjs'

const baseline = await Bun.file('tmp-test6-v8-connection-halo-report.json').json()
const result = projectHardHalos(baseline.nodes, {
  groups: baseline.groups,
  links: baseline.links,
  ...baseline.avoidance.options,
  root: baseline.nodes.findIndex((n) => n.id === 'test:internet'),
  fitFrames,
  maxPasses: 512,
  onPass: (p) => {
    if (p.pass < 5 || p.pass % 50 === 0 || p.pass === 511) console.log(JSON.stringify(p))
  },
})
console.log(
  JSON.stringify(
    result ? { passes: result.haloProjectionPasses, corrections: result.corrections } : null,
  ),
)
