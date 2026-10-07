import { readdirSync, readFileSync } from 'node:fs'
import { parseNetwork } from './model'

/**
 * Every state of knowledge the loop has met must stay writable (`pass/`), and every shape the
 * model refuses must stay refused (`fail/`). Run after each change: `bun fixtures.ts`.
 */
const here = (p: string) => new URL(p, import.meta.url)
let broken = 0

for (const expected of ['pass', 'fail'] as const) {
  for (const file of readdirSync(here(`fixtures/${expected}`)).sort()) {
    let error: string | undefined
    try {
      parseNetwork(Bun.YAML.parse(readFileSync(here(`fixtures/${expected}/${file}`), 'utf8')))
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
    const ok = expected === 'pass' ? error === undefined : error !== undefined
    if (!ok) broken++
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${expected}/${file}${error ? `  (${error})` : ''}`)
  }
}

if (broken > 0) {
  console.log(`\n${broken} fixture(s) broken`)
  process.exit(1)
}
