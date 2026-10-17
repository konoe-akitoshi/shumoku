// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { sampleNetworkModel, sampleNetworkYaml } from './fixtures/index.js'
import { createNetworkLayoutEngine, darkTheme, lightTheme, version } from './index.js'
import type { NetworkGraph } from './models/index.js'

describe('@shumoku/core', () => {
  describe('exports', () => {
    it('should export version', () => {
      expect(version).toBeDefined()
    })

    it('should export createNetworkLayoutEngine', () => {
      expect(createNetworkLayoutEngine).toBeDefined()
    })

    it('should export themes', () => {
      expect(lightTheme).toBeDefined()
      expect(darkTheme).toBeDefined()
    })
  })

  describe('NetworkLayoutEngine', () => {
    it('should create instance', () => {
      const engine = createNetworkLayoutEngine()
      expect(engine).toBeDefined()
      expect(engine.layoutAsync).toBeDefined()
    })

    it('should layout empty graph', async () => {
      const engine = createNetworkLayoutEngine()
      const graph: NetworkGraph = {
        nodes: [],
        links: [],
      }
      const result = await engine.layoutAsync(graph)
      expect(result).toBeDefined()
      expect(result.nodes).toBeDefined()
      expect(result.links).toBeDefined()
    })

    it('should layout graph with nodes only', async () => {
      const engine = createNetworkLayoutEngine()
      const graph: NetworkGraph = {
        nodes: [
          { id: 'router1', label: 'Router 1', type: 'router' },
          { id: 'switch1', label: 'Switch 1', type: 'l2-switch' },
        ],
        links: [],
      }
      const result = await engine.layoutAsync(graph)
      expect(result.nodes.size).toBe(2)
    })
  })

  describe('themes', () => {
    it('should have lightTheme with required properties', () => {
      expect(lightTheme.name).toBeDefined()
      expect(lightTheme.colors).toBeDefined()
      expect(lightTheme.colors.background).toBeDefined()
    })

    it('should have darkTheme with required properties', () => {
      expect(darkTheme.name).toBeDefined()
      expect(darkTheme.colors).toBeDefined()
      expect(darkTheme.colors.background).toBeDefined()
    })
  })

  describe('fixtures', () => {
    it('should export the sample network as YAML and as a model', () => {
      expect(sampleNetworkYaml).toContain('Sample Network')
      const model = sampleNetworkModel()
      expect(model.config.nodes.length).toBeGreaterThan(0)
      expect(model.config.groups?.map((g) => g.id)).toEqual(['cloud', 'perimeter', 'dmz', 'campus'])
    })
  })
})
