import { describe, expect, it } from 'vitest'
import { sampleNetwork } from './fixtures/index.js'
import { darkTheme, HierarchicalLayout, lightTheme, version } from './index.js'
import type { NetworkGraph } from './models/index.js'

describe('@shumoku/core', () => {
  describe('exports', () => {
    it('should export version', () => {
      expect(version).toBeDefined()
    })

    it('should export HierarchicalLayout', () => {
      expect(HierarchicalLayout).toBeDefined()
    })

    it('should export themes', () => {
      expect(lightTheme).toBeDefined()
      expect(darkTheme).toBeDefined()
    })
  })

  describe('HierarchicalLayout', () => {
    it('should create instance', () => {
      const engine = new HierarchicalLayout()
      expect(engine).toBeInstanceOf(HierarchicalLayout)
    })

    it('should layout empty graph', async () => {
      const engine = new HierarchicalLayout()
      const graph: NetworkGraph = {
        nodes: [],
        links: [],
      }
      const result = await engine.layout(graph)
      expect(result).toBeDefined()
      expect(result.nodes).toBeDefined()
      expect(result.links).toBeDefined()
    })

    it('should layout graph with nodes only', async () => {
      const engine = new HierarchicalLayout()
      const graph: NetworkGraph = {
        nodes: [
          { id: 'router1', label: 'Router 1', type: 'router' },
          { id: 'switch1', label: 'Switch 1', type: 'l2-switch' },
        ],
        links: [],
      }
      const result = await engine.layout(graph)
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
    it('should export sampleNetwork', () => {
      expect(sampleNetwork).toBeDefined()
      expect(Array.isArray(sampleNetwork)).toBe(true)
      expect(sampleNetwork.length).toBeGreaterThan(0)
    })

    it('should have main.yaml as first file', () => {
      expect(sampleNetwork[0].name).toBe('main.yaml')
      expect(sampleNetwork[0].content).toContain('Sample Network')
    })

    it('should have all required files', () => {
      const fileNames = sampleNetwork.map((f) => f.name)
      expect(fileNames).toContain('main.yaml')
      expect(fileNames).toContain('cloud.yaml')
      expect(fileNames).toContain('perimeter.yaml')
      expect(fileNames).toContain('dmz.yaml')
      expect(fileNames).toContain('campus.yaml')
    })
  })
})
