import { readFileSync } from 'node:fs'
import { parseNetwork } from '../../model'

// Prints "ok" or the parser error for one YAML file.
try {
  parseNetwork(Bun.YAML.parse(readFileSync(process.argv[2] ?? '', 'utf8')))
  console.log('ok')
} catch (e) {
  console.log(e instanceof Error ? e.message : String(e))
}
