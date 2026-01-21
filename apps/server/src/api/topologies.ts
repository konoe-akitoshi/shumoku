/**
 * Topologies API
 * CRUD endpoints for topology management
 */

import { Hono } from 'hono'
import { TopologyService } from '../services/topology.js'
import type { TopologyInput, ZabbixMapping } from '../types.js'
import { renderEmbeddable } from '@shumoku/renderer'

export function createTopologiesApi(): Hono {
  const app = new Hono()
  const service = new TopologyService()

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
        dataSourceId: parsed.dataSourceId,
        mapping: parsed.mapping,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  // Render topology as embeddable output (SVG + CSS + metadata)
  app.get('/:id/render', async (c) => {
    const id = c.req.param('id')
    try {
      const parsed = await service.getParsed(id)
      if (!parsed) {
        return c.json({ error: 'Topology not found' }, 404)
      }

      // Use renderEmbeddable for full interactive output with resolved icon dimensions
      const output = renderEmbeddable(
        { graph: parsed.graph, layout: parsed.layout, iconDimensions: parsed.iconDimensions },
        { hierarchical: true, toolbar: false },
      )

      return c.json({
        id: parsed.id,
        name: parsed.name,
        svg: output.svg,
        css: output.css,
        viewBox: output.viewBox,
        hierarchical: output.hierarchical,
        // Include stats
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
        dataSourceId: parsed.dataSourceId,
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
      if (!body.name || !body.yamlContent) {
        return c.json({ error: 'name and yamlContent are required' }, 400)
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
