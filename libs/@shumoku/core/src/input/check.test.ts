import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { readNetworkModel } from '../models/network-model-graph.js'
import { NetworkInputError } from './check.js'

// Every state of knowledge the input-model work met stays writable (`pass/`), and every shape the
// input refuses stays refused (`fail/`). Each file's comment says what it holds.
const fixtures = (kind: 'pass' | 'fail') =>
  readdirSync(new URL(`./fixtures/${kind}`, import.meta.url))
    .sort()
    .map((file) => [
      file,
      readFileSync(new URL(`./fixtures/${kind}/${file}`, import.meta.url), 'utf8'),
    ])

const issuesOf = (text: string) => {
  try {
    readNetworkModel(text)
  } catch (e) {
    if (e instanceof NetworkInputError) return e.issues
    throw e
  }
  return []
}

describe('readNetworkModel', () => {
  it.each(fixtures('pass'))('reads %s', (_, text) => {
    expect(issuesOf(text)).toEqual([])
  })

  it.each(fixtures('fail'))('refuses %s', (_, text) => {
    expect(issuesOf(text).length).toBeGreaterThan(0)
  })

  it('reports every issue at once, each with its path', () => {
    const issues = issuesOf(`
nodes:
  - { id: core, lable: Core }
  - { id: edge, asn: 0 }
links:
  - from: { node: core }
    to: { node: edge }
  - { endpoints: [{ node: core }, { node: nowhere }], speed: 10Gbps }
`)
    expect(issues.map((i) => i.path)).toEqual([
      'nodes[0].lable',
      'nodes[1].asn',
      'links[0].from',
      'links[0].to',
      'links[0].endpoints',
      'links[1].speed',
      'links[1].endpoints[1].node',
    ])
    expect(issues[0]?.message).toMatch(/did you mean label\?.*The fields here are id, label/)
    expect(issues[6]?.message).toBe('unknown node nowhere')
  })

  it('names the YAML line when the text is not YAML', () => {
    expect(issuesOf('nodes: [a\nlinks: ]')[0]?.path).toMatch(/^line \d+, column \d+$/)
  })

  it('reads a port YAML read as a number as that port name', () => {
    const { config } = readNetworkModel(`
nodes: [{ id: a }, { id: b }]
links:
  - endpoints: [{ node: a, port: 1 }, { node: b, port: ge-0/0/1 }]
`)
    expect(config.links[0]?.endpoints[0]).toEqual({ node: 'a', port: '1' })
  })
})
