// Copyright (C) 2026 system_explorer contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest'
import { SystemExplorerPlugin } from './plugin.js'

function makePlugin(config: Record<string, unknown> = {}): SystemExplorerPlugin {
  const plugin = new SystemExplorerPlugin()
  plugin.initialize(config)
  return plugin
}

describe('SystemExplorerPlugin', () => {
  it('has the expected identity and capabilities', () => {
    const plugin = makePlugin()
    expect(plugin.type).toBe('system-explorer')
    expect(plugin.displayName).toBe('System Explorer')
    expect(plugin.capabilities).toEqual(['topology', 'scenario'])
  })

  it('reports the bundled data set in testConnection', async () => {
    const result = await makePlugin().testConnection()
    expect(result.success).toBe(true)
    expect(result.message).toMatch(/6 samples, 7 scenarios bundled/)
  })

  it('lists the public samples only (no internal/operational data)', () => {
    const plugin = makePlugin()
    expect(plugin.listTopologies().sort()).toEqual([
      'bgp',
      'ipsec',
      'kerberos',
      'lvs-dns',
      'ra',
      'tailscale',
    ])
  })

  it('fetchTopology returns the authored SourceNetwork for the configured sample', async () => {
    const plugin = makePlugin({ sample: 'lvs-dns' })
    const source = await plugin.fetchTopology()
    expect(source.network.name).toBe('LVS/DSR DNS クラスタ')
    expect(source.network.nodes.length).toBeGreaterThan(0)
    expect(source.network.links.length).toBeGreaterThan(0)
    // Every node must reference a link endpoint, and links must reference nodes.
    const nodeIds = new Set(source.network.nodes.map((n) => n.id))
    for (const link of source.network.links) {
      for (const end of link.endpoints) {
        if (end.node) expect(nodeIds.has(end.node)).toBe(true)
      }
    }
  })

  it('defaults to the first bundled sample when none is configured', async () => {
    const first = makePlugin().listTopologies()[0]
    const viaDefault = await makePlugin().fetchTopology()
    const viaExplicit = await makePlugin({ sample: first }).fetchTopology()
    expect(viaDefault.network).toEqual(viaExplicit.network)
  })

  it('throws on an unknown sample', async () => {
    const plugin = makePlugin({ sample: 'does-not-exist' })
    await expect(plugin.fetchTopology()).rejects.toThrow(/unknown sample/)
  })

  it('lists scenarios keyed by their unique id and stamps the owning topology', () => {
    const plugin = makePlugin()
    const list = plugin.listScenarios()
    expect(list.length).toBe(7)
    const ids = list.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length) // ids are unique
    expect(ids).toContain('lvs-keepalived')
    const kee = list.find((s) => s.id === 'lvs-keepalived')
    if (!kee) throw new Error('lvs-keepalived scenario is missing from the bundled data')
    expect(kee.topology).toBe('lvs-dns') // two scenarios share one topology
    expect(kee.stepCount).toBeGreaterThan(0)
  })

  it('getScenario returns a parsed document with steps and events', () => {
    const plugin = makePlugin()
    const doc = plugin.getScenario('lvs-dns')
    expect(doc.id).toBe('lvs-dns')
    expect(doc.topology).toBe('lvs-dns')
    expect(Array.isArray(doc.steps)).toBe(true)
    expect(doc.steps.length).toBeGreaterThan(0)
    const evts = doc.steps.flatMap((s) => s.events)
    expect(evts.length).toBeGreaterThan(0)
    const kinds = new Set(evts.map((e) => e.kind))
    expect(kinds.has('pkt')).toBe(true)
    expect(kinds.has('local')).toBe(true)
  })

  it('getScenario throws on an unknown id', () => {
    expect(() => makePlugin().getScenario('nope')).toThrow(/unknown scenario/)
  })

  it('exposes a JSON Schema with the documented required fields', () => {
    const schema = makePlugin().scenarioSchema()
    expect(schema['$id']).toBe('https://shumoku.dev/schemas/system-explorer-scenario.json')
    expect(schema['required']).toEqual(['id', 'name', 'steps'])
    expect(schema['$defs']).toBeTruthy()
  })

  it('dispatches the scenario.* / topology.* nativeApi methods', async () => {
    const plugin = makePlugin()
    const viaNative = (await plugin.nativeApi('scenario.list', {})) as unknown
    expect(viaNative).toEqual(plugin.listScenarios())
    const doc = (await plugin.nativeApi('scenario.get', { id: 'ra' })) as { id: string }
    expect(doc.id).toBe('ra')
    const schema = (await plugin.nativeApi('scenario.schema', {})) as Record<string, unknown>
    expect(schema['$id']).toBeTruthy()
    const topologies = (await plugin.nativeApi('topology.list', {})) as string[]
    expect(topologies).toEqual(plugin.listTopologies())
    await expect(plugin.nativeApi('no.such.method', {})).rejects.toThrow(/unknown nativeApi method/)
  })
})
