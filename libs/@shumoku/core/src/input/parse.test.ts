import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { bitsPerSecond, flattenGroups, parseNetworkInput } from './index'

// Every state of knowledge the design loop met must stay writable (`pass/`), and every shape it
// refused must stay refused (`fail/`).
const fixtures = (kind: 'pass' | 'fail') =>
  readdirSync(new URL(`./fixtures/${kind}`, import.meta.url)).map((file) => [
    file,
    readFileSync(new URL(`./fixtures/${kind}/${file}`, import.meta.url), 'utf8'),
  ])

describe('parseNetworkInput', () => {
  it.each(fixtures('pass'))('accepts %s', (_, source) => {
    const result = parseNetworkInput(source)
    expect(result.ok ? [] : result.issues).toEqual([])
  })

  it.each(fixtures('fail'))('refuses %s', (_, source) => {
    expect(parseNetworkInput(source).ok).toBe(false)
  })

  it('reports every unknown field at once, with the fields allowed there', () => {
    const result = parseNetworkInput(`
nodes:
  - { id: a, model: x, os: y }
links:
  - { endpoints: [{ node: a }, { node: b }], vlans: [10] }
`)
    expect(result.ok ? [] : result.issues).toEqual([
      {
        path: 'nodes[0]',
        message: expect.stringMatching(/^unknown field model, os; the fields here are id, label,/),
      },
      {
        path: 'links[0]',
        message: expect.stringMatching(/^unknown field vlans; the fields here are endpoints,/),
      },
    ])
  })

  it('reports every broken reference at once once the shape holds', () => {
    const result = parseNetworkInput(`
segments: [{ id: v10 }]
nodes: [{ id: a, group: hall }]
links:
  - { endpoints: [{ node: a }, { node: v10 }] }
  - { endpoints: [{ node: a }, { node: b }], connection: vpn }
`)
    expect(result.ok ? [] : result.issues).toEqual([
      { path: 'nodes[0].group', message: 'unknown group hall; list it under groups' },
      {
        path: 'links[0].endpoints[1]',
        message: 'v10 is a segment; write this end as { segment: v10 }',
      },
      { path: 'links[1].endpoints[1]', message: 'unknown node b' },
      { path: 'links[1].connection', message: 'unknown connection vpn' },
    ])
  })

  it('refuses a key written twice instead of keeping the last', () => {
    const result = parseNetworkInput('nodes: []\nlinks: []\nlinks: []\n')
    expect(result.ok).toBe(false)
  })

  it('names an empty value as one to leave out', () => {
    const result = parseNetworkInput('nodes: [{ id: a, asn: }]\nlinks: []\n')
    expect(result.ok ? [] : result.issues).toEqual([
      { path: 'nodes[0].asn', message: 'empty; leave it out when it is not known' },
    ])
  })
})

describe('helpers', () => {
  it('turns a rate into bits per second', () => {
    expect(bitsPerSecond('2.5G')).toBe(2.5e9)
    expect(bitsPerSecond('300M')).toBe(3e8)
  })

  it('flattens nested groups with the group each is written inside', () => {
    const result = parseNetworkInput(
      'groups: [{ id: venue, groups: [{ id: 3f }] }]\nnodes: []\nlinks: []\n',
    )
    if (!result.ok) throw new Error(JSON.stringify(result.issues))
    expect(
      flattenGroups(result.network.groups ?? []).map(({ group, parent }) => [group.id, parent]),
    ).toEqual([
      ['venue', undefined],
      ['3f', 'venue'],
    ])
  })
})
