// biome-ignore-all lint/suspicious/noExplicitAny: walks whatever YAML a blind writer produced
// biome-ignore-all lint/suspicious/noUndeclaredEnvVars: the arm is chosen by run-t.sh
import { readFileSync } from 'node:fs'
import { parseNetwork } from '../../model'

// check-all.ts for the c1 and g shapes: renames their fields to the model's, flattens nested
// groups (g), and names the fields back in the errors.
const doc = normalize(Bun.YAML.parse(readFileSync(process.argv[2] ?? '', 'utf8')))
const errors: string[] = []
for (let tries = 0; tries < 50; tries++) {
  try {
    parseNetwork(doc)
    break
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const m = /^(.*): unknown field (\S+);/.exec(message)
    const at = m?.[1] === 'network' ? doc : m && resolve(doc, m[1] ?? '')
    errors.push(rename(message, m?.[1] ?? ''))
    if (!m || !at) break
    delete at[m[2] ?? '']
  }
}
console.log(errors.length === 0 ? 'ok' : errors.join('\n'))

function rename(message: string, at: string): string {
  const unconfirmed = at.startsWith('redundancy') ? 'pairingUnconfirmed' : 'existenceUnconfirmed'
  return message
    .replace(/\bassumed\b/g, unconfirmed)
    .replace(/\baddress\b(?!es)/g, 'addressInUnknownSegment')
    .replace(/, parent\b/, process.env.NESTED ? ', groups' : ', parent')
}

function normalize(d: any): any {
  const swap = (o: any, from: string, to: string) => {
    if (o && typeof o === 'object' && from in o) {
      o[to] = o[from]
      delete o[from]
    }
  }
  for (const n of d?.nodes ?? []) {
    swap(n, 'existenceUnconfirmed', 'assumed')
    swap(n, 'addressInUnknownSegment', 'address')
  }
  for (const l of d?.links ?? []) swap(l, 'existenceUnconfirmed', 'assumed')
  for (const r of d?.redundancy ?? []) swap(r, 'pairingUnconfirmed', 'assumed')
  if (process.env.NESTED && Array.isArray(d?.groups)) {
    const flat: any[] = []
    const walk = (gs: any[], parent?: string) => {
      for (const g of gs) {
        const { groups, ...rest } = g ?? {}
        flat.push({ ...rest, ...(parent && { parent }) })
        if (Array.isArray(groups)) walk(groups, g.id)
      }
    }
    walk(d.groups)
    d.groups = flat
  }
  return d
}

function resolve(root: any, path: string): any {
  return path.split('.').reduce((o, step) => {
    const [, key, index] = /^(\w+)(?:\[(\d+)\])?$/.exec(step) ?? []
    const v = o?.[key ?? '']
    return index === undefined ? v : v?.[Number(index)]
  }, root)
}
