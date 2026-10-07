import { readFileSync } from 'node:fs'
import { YamlParser } from '../../../libs/@shumoku/core/dist/index.js'
import { renderGraphToSvg } from '../../../libs/@shumoku/renderer-svg/dist/index.js'
import { toLegacyYaml } from './derive'
import { parseNetwork } from './model'

const here = (p: string) => new URL(p, import.meta.url)

/**
 * Each case pairs an existing input with its hand-written conversion: an example name, or
 * `original.yaml=converted.yaml` for data that must stay outside the repository.
 */
const cases = process.argv.slice(2)

for (const name of cases) {
  const [originalPath, convertedPath] = name.includes('=')
    ? name.split('=')
    : [here(`../../../examples/${name}.yaml`), here(`data/${name}.yaml`)]
  if (!originalPath || !convertedPath) throw new Error(`bad case: ${name}`)
  const original = readFileSync(originalPath, 'utf8')
  const converted = parseNetwork(Bun.YAML.parse(readFileSync(convertedPath, 'utf8')))
  const before = new YamlParser().parse(original).graph
  const after = new YamlParser().parse(JSON.stringify(toLegacyYaml(converted))).graph

  const lost = diff(canonical(before), canonical(after), '')
  const sameSvg =
    canonicalText(await renderGraphToSvg(before)) === canonicalText(await renderGraphToSvg(after))
  console.log(
    `\n## ${name}: ${lost.length} differences, SVG ${sameSvg ? 'identical' : 'DIFFERENT'}`,
  )
  for (const line of lost) console.log(`  ${line}`)
}

/** The parser mints random ids for ports it invents; number them by first appearance instead. */
function canonicalText(text: string): string {
  const seen = new Map<string, string>()
  return text.replace(/port-mig-[a-z0-9]+-\d+/g, (id) => {
    if (!seen.has(id)) seen.set(id, `minted-${seen.size}`)
    return seen.get(id) ?? id
  })
}

function canonical(value: unknown): unknown {
  return JSON.parse(canonicalText(JSON.stringify(value)))
}

function diff(a: unknown, b: unknown, path: string): string[] {
  if (Object.is(a, b)) return []
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    return [...keys].flatMap((k) =>
      diff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`),
    )
  }
  return [`${path}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`]
}
