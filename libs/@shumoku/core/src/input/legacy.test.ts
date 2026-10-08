import { readdirSync, readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'
import { sampleNetwork } from '../fixtures/index.js'
import { type YamlNetworkInput, YamlParser } from '../parser/parser.js'
import { fromLegacyInput, isNetworkInput, readNetworkInput, toLegacyInput } from './index.js'

const fixtures = (kind: 'pass' | 'fail') =>
  readdirSync(new URL(`./fixtures/${kind}`, import.meta.url)).map((file) => [
    file,
    readFileSync(new URL(`./fixtures/${kind}/${file}`, import.meta.url), 'utf8'),
  ])
const errors = (source: string) =>
  (new YamlParser().parse(source).warnings ?? []).filter((w) => w.severity === 'error')

describe('YamlParser with the input shape', () => {
  it.each(fixtures('pass'))('draws %s', (_, source) => {
    expect(errors(source)).toEqual([])
    const read = readNetworkInput(yaml.load(source))
    const drawn = new YamlParser().parse(source).graph
    expect(drawn.nodes.map((n) => n.id)).toEqual(read.ok ? read.network.nodes.map((n) => n.id) : [])
  })

  it.each(fixtures('fail'))('refuses %s once it is read as the input shape', (_, source) => {
    let loaded: unknown
    try {
      loaded = yaml.load(source)
    } catch {
      expect(errors(source).map((e) => e.code)).toEqual(['PARSE_ERROR'])
      return
    }
    // A document using only older fields is still the older shape, which reads loosely.
    if (!isNetworkInput(loaded)) return
    expect(errors(source).length).toBeGreaterThan(0)
    expect(errors(source).every((e) => e.code === 'INPUT_ISSUE')).toBe(true)
  })

  it('reports every issue, each with its path', () => {
    const source =
      'nodes: [{ id: a, colour: red }]\nlinks: [{ endpoints: [{ node: a }, { node: b }] }]\n'
    expect(errors(source).map((e) => e.message)).toEqual([
      'nodes[0]: unknown field colour; the fields here are id, label, type, product, software, address, asn, description, group, assumed, host, members',
    ])
  })

  it('reads a document mixing the shapes as the input shape, so the older fields are named', () => {
    const source = 'nodes: [{ id: a, group: g, parent: g }]\nlinks: []\n'
    expect(errors(source).map((e) => e.message)).toEqual([
      expect.stringContaining('nodes[0]: unknown field parent'),
    ])
  })

  it('keeps reading the older shape', () => {
    for (const file of sampleNetwork) expect(isNetworkInput(yaml.load(file.content))).toBe(false)
    expect(isNetworkInput({ nodes: [{ id: 'a' }] })).toBe(false)
  })
})

describe('fromLegacyInput', () => {
  const legacy: YamlNetworkInput = {
    name: 'old',
    settings: { theme: 'dark' },
    subgraphs: [
      { id: 'site', label: 'Site' },
      { id: 'room', parent: 'site', style: { fill: 'red' } },
      { id: 'rack', children: [] },
    ],
    nodes: [
      {
        id: 'r1',
        label: ['<b>Router 1</b>', '10.0.0.1'],
        vendor: 'juniper',
        model: 'mx204',
        parent: 'room',
      },
      { id: 'r2', type: 'router', model: 'mx204' },
      { id: 'sw', shape: 'rect' },
    ],
    links: [
      {
        from: { node: 'r1', port: 'xe-0/0/0', ip: '10.0.1.1/30' },
        to: 'sw',
        vlan: 10,
        standard: '10GBASE-SR',
        cable: { category: 'om4', length_m: 3 },
      },
      { from: 'r2', to: 'sw', vlan: [10, 20], label: 'trunk' },
      { from: 'r1', to: 'r2', redundancy: 'ha' },
    ],
  }

  it('carries the facts and names what it leaves out', () => {
    const { network, dropped } = fromLegacyInput(legacy)
    expect(network).toEqual({
      name: 'old',
      groups: [{ id: 'site', label: 'Site', groups: [{ id: 'room' }] }, { id: 'rack' }],
      segments: [
        { id: 'vlan-10', vlan: 10, addresses: { r1: '10.0.1.1/30' } },
        { id: 'vlan-20', vlan: 20 },
      ],
      redundancy: [{ id: 'ha-r1-r2', nodes: ['r1', 'r2'] }],
      nodes: [
        {
          id: 'r1',
          label: 'Router 1',
          product: 'juniper/mx204',
          description: '10.0.0.1',
          group: 'room',
        },
        { id: 'r2', type: 'router', product: '?/mx204' },
        { id: 'sw' },
      ],
      links: [
        {
          endpoints: [{ node: 'r1', port: 'xe-0/0/0' }, { node: 'sw' }],
          speed: '10G',
          cable: 'om4',
          length: '3m',
          segments: ['vlan-10'],
        },
        { endpoints: [{ node: 'r2' }, { node: 'sw' }], segments: ['vlan-10', 'vlan-20'] },
        { endpoints: [{ node: 'r1' }, { node: 'r2' }] },
      ],
    })
    expect(dropped.sort()).toEqual([
      'links[].label',
      'nodes[].shape',
      'settings',
      'subgraphs[].style',
    ])
    expect(readNetworkInput(network).ok).toBe(true)
  })

  it.each(sampleNetwork.filter((f) => f.name !== 'main.yaml').map((f) => [f.name, f.content]))(
    'converts the sample %s into input that reads and draws',
    (_, content) => {
      const { network } = fromLegacyInput(yaml.load(content) as YamlNetworkInput)
      const read = readNetworkInput(network)
      expect(read.ok ? [] : read.issues).toEqual([])
      if (!read.ok) return
      expect(errors(yaml.dump(toLegacyInput(read.network)))).toEqual([])
    },
  )
})
