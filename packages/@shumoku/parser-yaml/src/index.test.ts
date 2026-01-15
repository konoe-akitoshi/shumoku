import { sampleNetwork } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { createMemoryFileResolver, HierarchicalParser, parser, YamlParser } from './index.js'

describe('@shumoku/parser-yaml', () => {
  describe('exports', () => {
    it('should export parser instance', () => {
      expect(parser).toBeDefined()
      expect(parser).toBeInstanceOf(YamlParser)
    })

    it('should export YamlParser class', () => {
      expect(YamlParser).toBeDefined()
    })
  })

  describe('YamlParser', () => {
    it('should create instance', () => {
      const p = new YamlParser()
      expect(p).toBeInstanceOf(YamlParser)
    })

    it('should parse empty yaml', () => {
      const result = parser.parse('')
      expect(result.graph).toBeDefined()
      expect(result.graph.nodes).toEqual([])
      expect(result.graph.links).toEqual([])
    })

    it('should parse simple network', () => {
      const yaml = `
nodes:
  - id: router1
    label: Router 1
    type: router
  - id: switch1
    label: Switch 1
    type: l2-switch
links:
  - from: router1
    to: switch1
`
      const result = parser.parse(yaml)
      expect(result.graph.nodes).toHaveLength(2)
      expect(result.graph.links).toHaveLength(1)
    })

    it('should parse node with type alias', () => {
      const yaml = `
nodes:
  - id: fw1
    label: Firewall 1
    type: firewall
`
      const result = parser.parse(yaml)
      expect(result.graph.nodes).toHaveLength(1)
      expect(result.graph.nodes[0].type).toBe('firewall')
    })

    it('should parse link with bandwidth', () => {
      const yaml = `
nodes:
  - id: a
    label: A
  - id: b
    label: B
links:
  - from: a
    to: b
    bandwidth: 10G
`
      const result = parser.parse(yaml)
      expect(result.graph.links[0].bandwidth).toBe('10G')
    })

    it('should parse subgraphs', () => {
      const yaml = `
nodes:
  - id: server1
    label: Server
subgraphs:
  - id: dc1
    label: Data Center 1
    nodes: [server1]
`
      const result = parser.parse(yaml)
      expect(result.graph.subgraphs).toBeDefined()
      expect(result.graph.subgraphs).toHaveLength(1)
      expect(result.graph.subgraphs![0].id).toBe('dc1')
    })

    it('should handle parse errors gracefully', () => {
      const yaml = `invalid: [unclosed`
      const result = parser.parse(yaml)
      expect(result.warnings).toBeDefined()
      expect(result.warnings!.length).toBeGreaterThan(0)
    })
  })

  describe('HierarchicalParser with sampleNetwork fixture', () => {
    it('should parse sample network main file', () => {
      const mainFile = sampleNetwork.find((f) => f.name === 'main.yaml')
      expect(mainFile).toBeDefined()

      const result = parser.parse(mainFile!.content)
      expect(result.graph).toBeDefined()
      expect(result.graph.name).toBe('Sample Network')
      expect(result.graph.subgraphs).toBeDefined()
      expect(result.graph.subgraphs!.length).toBeGreaterThan(0)
    })

    it('should parse all sample network files', () => {
      for (const file of sampleNetwork) {
        const result = parser.parse(file.content)
        expect(result.graph).toBeDefined()
        const errors = result.warnings?.filter((w) => w.severity === 'error') ?? []
        expect(errors).toHaveLength(0)
      }
    })

    it('should parse sample network hierarchically', async () => {
      const fileMap = new Map<string, string>()
      for (const f of sampleNetwork) {
        // Map with multiple path formats for compatibility
        fileMap.set(f.name, f.content)
        fileMap.set(`./${f.name}`, f.content)
        fileMap.set(`/${f.name}`, f.content)
      }

      const resolver = createMemoryFileResolver(fileMap, '/')
      const hierarchicalParser = new HierarchicalParser(resolver)
      const result = await hierarchicalParser.parse(sampleNetwork[0].content, '/main.yaml')

      expect(result.graph).toBeDefined()
      expect(result.graph.name).toBe('Sample Network')
      expect(result.sheets).toBeDefined()

      // Sheets are created when file references are resolved
      // The hierarchical parser should have parsed the subgraph files
      const subgraphIds = ['cloud', 'perimeter', 'dmz', 'campus']
      for (const id of subgraphIds) {
        const subgraph = result.graph.subgraphs?.find((s) => s.id === id)
        expect(subgraph).toBeDefined()
      }
    })

    it('should resolve cross-file links correctly', async () => {
      const fileMap = new Map<string, string>()
      for (const f of sampleNetwork) {
        fileMap.set(f.name, f.content)
        fileMap.set(`./${f.name}`, f.content)
      }

      const resolver = createMemoryFileResolver(fileMap, '/')
      const hierarchicalParser = new HierarchicalParser(resolver)
      const result = await hierarchicalParser.parse(sampleNetwork[0].content, '/main.yaml')

      // Main graph should have cross-subgraph links
      const crossLinks = result.graph.links.filter(
        (link) =>
          (link.from.node === 'vgw' && link.to.node === 'rt1') ||
          (link.from.node === 'fw1' && link.to.node === 'dmz-sw'),
      )
      expect(crossLinks.length).toBeGreaterThan(0)
    })
  })
})
