import { readdirSync, readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'
import { YamlParser } from '../parser/parser.js'
import { parseNetworkInput, toLegacyInput } from './index.js'

const passing = readdirSync(new URL('./fixtures/pass', import.meta.url)).map((file) => [
  file,
  readFileSync(new URL(`./fixtures/pass/${file}`, import.meta.url), 'utf8'),
])

describe('toLegacyInput', () => {
  it.each(passing)('draws %s through the older parser', (_, source) => {
    const read = parseNetworkInput(source)
    if (!read.ok) throw new Error('expected ok')
    const { graph, warnings } = new YamlParser().parse(yaml.dump(toLegacyInput(read.network)))
    expect((warnings ?? []).filter((w) => w.severity === 'error')).toEqual([])
    expect(graph.nodes.map((n) => n.id)).toEqual(read.network.nodes.map((n) => n.id))
  })
})
