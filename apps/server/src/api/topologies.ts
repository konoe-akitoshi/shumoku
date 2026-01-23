/**
 * Topologies API
 * CRUD endpoints for topology management
 */

import { Hono } from 'hono'
import { TopologyService } from '../services/topology.js'
import { DataSourceService } from '../services/datasource.js'
import type { TopologyInput, ZabbixMapping } from '../types.js'
import { renderEmbeddable, type EmbeddableRenderOutput } from '@shumoku/renderer'
import { buildHierarchicalSheets } from '@shumoku/core'
import { BunHierarchicalLayout } from '../layout.js'

export function createTopologiesApi(): Hono {
  const app = new Hono()
  const service = new TopologyService()
  const dataSourceService = new DataSourceService()

  // List all topologies
  app.get('/', (c) => {
    const topologies = service.list()
    return c.json(topologies)
  })

  // Get parsed topology with graph and layout
  // NOTE: More specific routes must be defined before /:id
  app.get('/:id/parsed', async (c) => {
    const id = c.req.param('id')
    try {
      const parsed = await service.getParsed(id)
      if (!parsed) {
        return c.json({ error: 'Topology not found' }, 404)
      }

      // Convert LayoutResult Maps to plain objects for JSON serialization
      // Cytoscape converter expects { nodeId: { x, y } } format
      const layoutNodes: Record<string, { x: number; y: number }> = {}
      for (const [nodeId, layoutNode] of parsed.layout.nodes) {
        layoutNodes[nodeId] = {
          x: layoutNode.position.x,
          y: layoutNode.position.y,
        }
      }

      return c.json({
        id: parsed.id,
        name: parsed.name,
        graph: parsed.graph,
        layout: {
          nodes: layoutNodes,
          bounds: parsed.layout.bounds,
        },
        metrics: parsed.metrics,
        topologySourceId: parsed.topologySourceId,
        metricsSourceId: parsed.metricsSourceId,
        mapping: parsed.mapping,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  // Render topology as embeddable output (SVG + CSS + metadata)
  // Supports hierarchical topologies with multiple sheets
  app.get('/:id/render', async (c) => {
    const id = c.req.param('id')
    try {
      const parsed = await service.getParsed(id)
      if (!parsed) {
        return c.json({ error: 'Topology not found' }, 404)
      }

      // Check if topology has hierarchical content
      const hasSubgraphs = parsed.graph.subgraphs && parsed.graph.subgraphs.length > 0

      if (hasSubgraphs) {
        // Build hierarchical sheets
        const layoutEngine = new BunHierarchicalLayout({
          iconDimensions: parsed.iconDimensions.byKey,
        })
        const sheets = await buildHierarchicalSheets(parsed.graph, parsed.layout, layoutEngine)

        // Render each sheet
        const renderedSheets: Record<
          string,
          {
            svg: string
            css: string
            viewBox: EmbeddableRenderOutput['viewBox']
            label: string
            parentId: string | null
          }
        > = {}

        for (const [sheetId, sheetData] of sheets) {
          const output = renderEmbeddable(
            {
              graph: sheetData.graph,
              layout: sheetData.layout,
              iconDimensions: parsed.iconDimensions,
            },
            { hierarchical: true, toolbar: false },
          )

          // Find parent for breadcrumb navigation
          let parentId: string | null = null
          let label = sheetData.graph.name || sheetId

          if (sheetId !== 'root') {
            parentId = 'root' // All child sheets have root as parent for now
            const subgraph = parsed.graph.subgraphs?.find((sg) => sg.id === sheetId)
            if (subgraph) {
              label = subgraph.label || sheetId
            }
          }

          renderedSheets[sheetId] = {
            svg: output.svg,
            css: output.css,
            viewBox: output.viewBox,
            label,
            parentId,
          }
        }

        return c.json({
          id: parsed.id,
          name: parsed.name,
          hierarchical: true,
          sheets: renderedSheets,
          rootSheetId: 'root',
          nodeCount: parsed.graph.nodes.length,
          edgeCount: parsed.graph.links.length,
        })
      }

      // Non-hierarchical: return single sheet
      const output = renderEmbeddable(
        { graph: parsed.graph, layout: parsed.layout, iconDimensions: parsed.iconDimensions },
        { hierarchical: false, toolbar: false },
      )

      return c.json({
        id: parsed.id,
        name: parsed.name,
        hierarchical: false,
        svg: output.svg,
        css: output.css,
        viewBox: output.viewBox,
        nodeCount: parsed.graph.nodes.length,
        edgeCount: parsed.graph.links.length,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  // Get topology context (simplified - just stats from graph)
  app.get('/:id/context', async (c) => {
    const id = c.req.param('id')
    try {
      const parsed = await service.getParsed(id)
      if (!parsed) {
        return c.json({ error: 'Topology not found' }, 404)
      }

      // Return simplified context with node/edge info from graph
      return c.json({
        id: parsed.id,
        name: parsed.name,
        nodes: parsed.graph.nodes.map((n) => ({
          id: n.id,
          label: n.label || n.id,
          type: n.type,
        })),
        edges: parsed.graph.links.map((l, i) => ({
          id: l.id || `link-${i}`,
          from: typeof l.from === 'string' ? l.from : l.from.node,
          to: typeof l.to === 'string' ? l.to : l.to.node,
        })),
        subgraphs: parsed.graph.subgraphs || [],
        metrics: parsed.metrics,
        topologySourceId: parsed.topologySourceId,
        metricsSourceId: parsed.metricsSourceId,
        mapping: parsed.mapping,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  // Get single topology (must be after all /:id/* routes)
  app.get('/:id', (c) => {
    const id = c.req.param('id')
    const topology = service.get(id)
    if (!topology) {
      return c.json({ error: 'Topology not found' }, 404)
    }
    return c.json(topology)
  })

  // Create new topology
  app.post('/', async (c) => {
    try {
      const body = (await c.req.json()) as TopologyInput
      if (!body.name || !body.contentJson) {
        return c.json({ error: 'name and contentJson are required' }, 400)
      }

      const topology = await service.create(body)
      return c.json(topology, 201)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 400)
    }
  })

  // Update topology
  app.put('/:id', async (c) => {
    const id = c.req.param('id')
    try {
      const body = (await c.req.json()) as Partial<TopologyInput>
      const topology = await service.update(id, body)
      if (!topology) {
        return c.json({ error: 'Topology not found' }, 404)
      }
      return c.json(topology)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 400)
    }
  })

  // Update mapping
  app.put('/:id/mapping', async (c) => {
    const id = c.req.param('id')
    try {
      const mapping = (await c.req.json()) as ZabbixMapping
      const topology = service.updateMapping(id, mapping)
      if (!topology) {
        return c.json({ error: 'Topology not found' }, 404)
      }
      return c.json(topology)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 400)
    }
  })

  // Get auto-mapping hints for a topology
  app.get('/:id/mapping-hints', async (c) => {
    const id = c.req.param('id')
    try {
      const parsed = await service.getParsed(id)
      if (!parsed) {
        return c.json({ error: 'Topology not found' }, 404)
      }

      if (!parsed.metricsSourceId) {
        return c.json({ error: 'No metrics source configured' }, 400)
      }

      const hints = await dataSourceService.getMappingHints(parsed.metricsSourceId, parsed.graph)
      return c.json(hints)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  // Delete topology
  app.delete('/:id', (c) => {
    const id = c.req.param('id')
    const deleted = service.delete(id)
    if (!deleted) {
      return c.json({ error: 'Topology not found' }, 404)
    }
    return c.json({ success: true })
  })

  return app
}
