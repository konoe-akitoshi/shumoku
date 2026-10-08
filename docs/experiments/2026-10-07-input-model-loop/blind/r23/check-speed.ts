// biome-ignore-all lint/suspicious/noExplicitAny: walks whatever YAML a blind writer produced
// biome-ignore-all lint/suspicious/noUndeclaredEnvVars: the arm is chosen by the runner
import { readFileSync } from 'node:fs'
import { parseNetwork } from '../../model'

// check-all.ts for the speed arms: checks the arm's rate fields, then hands the rest to the model.
const arm = process.env.ARM ?? 'a'
const doc = Bun.YAML.parse(readFileSync(process.argv[2] ?? '', 'utf8'))
const errors: string[] = []
const rate = /^\d+(\.\d+)?[MGT]$/
for (const [i, l] of (doc?.links ?? []).entries()) {
  if (!l || typeof l !== 'object') continue
  const at = `links[${i}]`
  if (arm === 'b') {
    if (l.speedMbps !== undefined && (typeof l.speedMbps !== 'number' || l.speedMbps <= 0))
      errors.push(`${at}.speedMbps: expected a positive number`)
    delete l.speedMbps
    continue
  }
  if (l.speed !== undefined && (arm === 'c' ? !rate.test(String(l.speed)) : false))
    errors.push(`${at}.speed: expected a number and M, G or T, such as 2.5G`)
  if (arm === 'd3' && l.speed !== undefined && !rate.test(String(l.speed)))
    errors.push(`${at}.speed: expected a number and M, G or T, such as 2.5G`)
  if (arm === 'c' || arm === 'd3') delete l.speed
  if (arm.startsWith('d')) {
    if (l.bandwidth !== undefined && !rate.test(String(l.bandwidth)))
      errors.push(`${at}.bandwidth: expected a number and M, G or T, such as 2.5G`)
    delete l.bandwidth
  }
}
for (let tries = 0; tries < 50; tries++) {
  try {
    parseNetwork(doc)
    break
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const m = /^(.*): unknown field (\S+);/.exec(message)
    const at = m?.[1] === 'network' ? doc : m && resolve(doc, m[1] ?? '')
    const fields: Record<string, string> = {
      b: 'speedMbps',
      c: 'speed',
      d: 'speed, bandwidth',
      d2: 'speed, bandwidth',
      d3: 'speed, bandwidth',
    }
    errors.push(
      arm !== 'a' && m?.[1]?.startsWith('links')
        ? message.replace(
            /fields here are endpoints, speed,/,
            `fields here are endpoints, ${fields[arm]},`,
          )
        : message,
    )
    if (!m || !at) break
    delete at[m[2] ?? '']
  }
}
console.log(errors.length === 0 ? 'ok' : errors.join('\n'))

function resolve(root: any, path: string): any {
  return path.split('.').reduce((o, step) => {
    const [, key, index] = /^(\w+)(?:\[(\d+)\])?$/.exec(step) ?? []
    const v = o?.[key ?? '']
    return index === undefined ? v : v?.[Number(index)]
  }, root)
}
