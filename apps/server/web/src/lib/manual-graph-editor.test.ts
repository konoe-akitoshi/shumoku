import type { NetworkGraph } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import {
  readManualGraphEditor,
  seedManualGraphEditor,
  switchManualGraphEditor,
} from './manual-graph-editor'

const graph: NetworkGraph = {
  version: '2.0.0',
  nodes: [{ id: 'a', label: 'A', presence: 'anchor' }],
  links: [],
}

describe('Manual graph editor', () => {
  it('saves an untouched YAML preview without losing observation-only fields', () => {
    expect(readManualGraphEditor(seedManualGraphEditor(graph))).toEqual(graph)
  })

  it('preserves JSON text and fields across a JSON → YAML → JSON round trip', () => {
    const initial = { ...seedManualGraphEditor(graph), mode: 'json' as const }
    const yaml = switchManualGraphEditor(initial, 'yaml')
    expect(readManualGraphEditor(yaml)).toEqual(graph)
    expect(switchManualGraphEditor(yaml, 'json').json).toBe(initial.json)
  })

  it('saves newly edited JSON from its untouched YAML preview', () => {
    const updated = { ...graph, name: 'new name' }
    const state = {
      ...seedManualGraphEditor(graph),
      mode: 'json' as const,
      json: JSON.stringify(updated),
    }
    expect(readManualGraphEditor(switchManualGraphEditor(state, 'yaml'))).toEqual(updated)
  })

  it('rejects edited YAML with non-authorable fields rather than saving stale JSON', () => {
    const state = seedManualGraphEditor(graph)
    const edited = { ...state, yaml: state.yaml.replace('label: A', 'label: Changed') }
    expect(() => readManualGraphEditor(edited)).toThrow('observation-layer')
    expect(() => switchManualGraphEditor(edited, 'json')).toThrow('observation-layer')
    expect(edited.json).toBe(state.json)
  })

  it('saves authorable YAML edits and preserves comments on an untouched return trip', () => {
    const state = seedManualGraphEditor({
      version: '2.0.0',
      nodes: [{ id: 'a', label: 'A' }],
      links: [],
    })
    const edited = { ...state, yaml: `# note\n${state.yaml.replace('label: A', 'label: B')}` }
    expect(readManualGraphEditor(edited).nodes[0]?.label).toBe('B')
    const json = switchManualGraphEditor(edited, 'json')
    expect(switchManualGraphEditor(json, 'yaml').yaml).toBe(edited.yaml)
  })

  it('rejects invalid YAML and unknown keys without mutating the previous state', () => {
    for (const yaml of ['nodes: [', 'nodes: []\nlinks: []\nlable: typo']) {
      const state = { ...seedManualGraphEditor(graph), yaml }
      const before = structuredClone(state)
      expect(() => switchManualGraphEditor(state, 'json')).toThrow('Invalid YAML')
      expect(state).toEqual(before)
    }
  })

  it('rejects a pasted JSON API envelope on conversion and save', () => {
    const state = {
      ...seedManualGraphEditor(graph),
      mode: 'json' as const,
      json: JSON.stringify({ graph, capturedAt: '2026-09-03' }),
    }
    expect(() => readManualGraphEditor(state)).toThrow('Expected a graph')
    expect(() => switchManualGraphEditor(state, 'yaml')).toThrow('Expected a graph')
  })

  it('reseeds both snapshots when another source is loaded', () => {
    const next = { version: '2.0.0', nodes: [{ id: 'b', label: 'B' }], links: [] }
    const old = switchManualGraphEditor(seedManualGraphEditor(graph), 'json')
    const fresh = seedManualGraphEditor(next)
    expect(readManualGraphEditor(fresh)).toEqual(next)
    expect(fresh.jsonSnapshot).not.toBe(old.jsonSnapshot)
  })
})
