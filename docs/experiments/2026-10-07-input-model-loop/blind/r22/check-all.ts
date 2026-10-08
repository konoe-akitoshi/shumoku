// biome-ignore-all lint/suspicious/noExplicitAny: walks whatever YAML a blind writer produced
// biome-ignore-all lint/suspicious/noUndeclaredEnvVars: the arm is chosen by run-t.sh
import { readFileSync } from 'node:fs'
import { parseNetwork } from '../../model'

// Prints "ok" or every unknown field at once, then the first other error, as zod would list all
// issues. An unknown field is dropped and the parse retried, so the later ones surface too.
const doc = Bun.YAML.parse(readFileSync(process.argv[2] ?? '', 'utf8'))
const errors: string[] = []
for (let tries = 0; tries < 50; tries++) {
  try {
    parseNetwork(doc)
    break
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const m = /^(.*): unknown field (\S+);/.exec(message)
    const at = m?.[1] === 'network' ? doc : m && resolve(doc, m[1] ?? '')
    errors.push(message)
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
