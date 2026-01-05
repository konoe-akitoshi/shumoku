/**
 * Hierarchical Layout Engine
 * Creates layered layouts based on network hierarchy (Core -> Distribution -> Access)
 */

import { BaseLayoutEngine } from './base'
import type { NetworkGraph } from '../models'
import type { LayoutOptions, LayoutResult, LayoutNode } from './types'

interface Layer {
  level: number
  nodes: string[]
}

export class HierarchicalLayoutEngine extends BaseLayoutEngine {
  name = 'hierarchical'
  version = '1.0.0'

  async layout(graph: NetworkGraph, options?: LayoutOptions): Promise<LayoutResult> {
    const startTime = performance.now()
    const opts = { ...this.getDefaultOptions(), ...options }

    // Create initial nodes and edges
    const nodes = this.createNodes(graph.devices, opts)
    const edges = this.createEdges(graph.links)

    // Build adjacency list
    const adjacency = this.buildAdjacency(graph)

    // Detect layers using BFS or role-based assignment
    const layers = this.detectLayers(graph, adjacency)

    // Position nodes in layers
    this.positionLayers(layers, nodes, opts)

    // Minimize edge crossings
    this.minimizeCrossings(layers, adjacency, nodes)

    // Route edges
    this.routeEdges(edges, nodes, opts.edgeRouting)

    // Create module boundaries
    const modules = this.createModules(graph.modules, nodes)

    // Calculate bounds
    const bounds = this.calculateBounds(nodes)

    const duration = performance.now() - startTime

    return {
      nodes,
      edges,
      modules,
      bounds,
      metadata: {
        algorithm: this.name,
        duration,
        iterations: layers.length,
      },
    }
  }

  /**
   * Build adjacency list from links
   */
  private buildAdjacency(graph: NetworkGraph): Map<string, Set<string>> {
    const adjacency = new Map<string, Set<string>>()

    // Initialize all nodes
    graph.devices.forEach((device) => {
      adjacency.set(device.id, new Set())
    })

    // Add edges (bidirectional)
    graph.links.forEach((link) => {
      const source = adjacency.get(link.source.deviceId)
      const target = adjacency.get(link.target.deviceId)

      if (source && target) {
        source.add(link.target.deviceId)
        target.add(link.source.deviceId)
      }
    })

    return adjacency
  }

  /**
   * Detect layers using device roles or graph analysis
   */
  private detectLayers(graph: NetworkGraph, adjacency: Map<string, Set<string>>): Layer[] {
    // First try role-based assignment - 外部接続を最上部に
    const roleOrder = ['edge', 'core', 'distribution', 'access']
    const roleLayers = new Map<string, number>()

    // Map roles to layer numbers
    roleOrder.forEach((role, index) => {
      roleLayers.set(role, index)
    })

    // Assign devices to layers based on roles
    const deviceLayers = new Map<string, number>()
    let hasRoles = false

    graph.devices.forEach((device) => {
      if (device.role && roleLayers.has(device.role)) {
        deviceLayers.set(device.id, roleLayers.get(device.role)!)
        hasRoles = true
      }
    })

    // If no roles or incomplete, use graph analysis
    if (!hasRoles || deviceLayers.size < graph.devices.length) {
      this.assignLayersByConnectivity(graph, adjacency, deviceLayers)
    }

    // Group devices by layer
    const layers: Layer[] = []
    const layerMap = new Map<number, string[]>()

    deviceLayers.forEach((level, deviceId) => {
      const nodes = layerMap.get(level) || []
      nodes.push(deviceId)
      layerMap.set(level, nodes)
    })

    // Convert to array
    const sortedLevels = Array.from(layerMap.keys()).sort((a, b) => a - b)
    sortedLevels.forEach((level) => {
      layers.push({
        level,
        nodes: layerMap.get(level) || [],
      })
    })

    return layers
  }

  /**
   * Assign layers based on connectivity patterns
   */
  private assignLayersByConnectivity(
    graph: NetworkGraph,
    adjacency: Map<string, Set<string>>,
    deviceLayers: Map<string, number>,
  ): void {
    // Find root nodes (highest connectivity or no parents)
    const roots: string[] = []
    let maxDegree = 0

    adjacency.forEach((neighbors, deviceId) => {
      if (!deviceLayers.has(deviceId)) {
        const degree = neighbors.size
        if (degree > maxDegree) {
          maxDegree = degree
          roots.length = 0
          roots.push(deviceId)
        } else if (degree === maxDegree) {
          roots.push(deviceId)
        }
      }
    })

    // BFS from roots to assign layers
    const queue: { id: string; level: number }[] = []
    const visited = new Set<string>()

    // Start with roots at level 0 (or next available level)
    const startLevel = Math.max(-1, ...Array.from(deviceLayers.values())) + 1
    roots.forEach((root) => {
      queue.push({ id: root, level: startLevel })
      visited.add(root)
    })

    while (queue.length > 0) {
      const { id, level } = queue.shift()!

      if (!deviceLayers.has(id)) {
        deviceLayers.set(id, level)
      }

      const neighbors = adjacency.get(id) || new Set()
      neighbors.forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push({ id: neighbor, level: level + 1 })
        }
      })
    }

    // Assign any remaining unconnected devices
    graph.devices.forEach((device) => {
      if (!deviceLayers.has(device.id)) {
        deviceLayers.set(device.id, startLevel + 2)
      }
    })
  }

  /**
   * Position nodes within their layers
   */
  private positionLayers(
    layers: Layer[],
    nodes: Map<string, LayoutNode>,
    options: LayoutOptions,
  ): void {
    const layerSpacing = options.layerSpacing || 400
    const nodeSpacing = options.nodeSpacing || 250

    layers.forEach((layer, layerIndex) => {
      // 縦向きレイアウト（上から下へ）
      const y = layerIndex * layerSpacing + 100 // オフセットを追加

      // レイヤー内のノード数に応じて動的にスペーシングを調整
      const adjustedSpacing = layer.nodes.length > 4 ? nodeSpacing * 0.8 : nodeSpacing
      const layerWidth = (layer.nodes.length - 1) * adjustedSpacing
      const startX = layerWidth / 2 // 中心を0に

      // 特定のレイヤーで複数行配置を使用
      if (layer.nodes.length > 6) {
        // 2行に分割
        const nodesPerRow = Math.ceil(layer.nodes.length / 2)
        layer.nodes.forEach((nodeId, nodeIndex) => {
          const node = nodes.get(nodeId)
          if (
            node &&
            (!node.data.position ||
              node.data.position.x === 'auto' ||
              node.data.position.y === 'auto' ||
              !options.respectManualPositions)
          ) {
            const row = Math.floor(nodeIndex / nodesPerRow)
            const col = nodeIndex % nodesPerRow
            const rowWidth = (nodesPerRow - 1) * adjustedSpacing

            node.position = {
              x: col * adjustedSpacing - rowWidth / 2,
              y: y + row * 150, // 行間のスペース
            }
          }
        })
      } else {
        // 通常の1行配置
        layer.nodes.forEach((nodeId, nodeIndex) => {
          const node = nodes.get(nodeId)
          if (
            node &&
            (!node.data.position ||
              node.data.position.x === 'auto' ||
              node.data.position.y === 'auto' ||
              !options.respectManualPositions)
          ) {
            node.position = {
              x: nodeIndex * adjustedSpacing - startX,
              y: y,
            }
          }
        })
      }
    })
  }

  /**
   * Minimize edge crossings using layer-by-layer sweep
   */
  private minimizeCrossings(
    layers: Layer[],
    adjacency: Map<string, Set<string>>,
    nodes: Map<string, LayoutNode>,
  ): void {
    // Simple barycenter heuristic
    for (let iter = 0; iter < 3; iter++) {
      // Forward pass
      for (let i = 1; i < layers.length; i++) {
        this.orderLayerByBarycenter(layers[i], layers[i - 1], adjacency, nodes)
      }

      // Backward pass
      for (let i = layers.length - 2; i >= 0; i--) {
        this.orderLayerByBarycenter(layers[i], layers[i + 1], adjacency, nodes)
      }
    }
  }

  /**
   * Order nodes in a layer by barycenter method
   */
  private orderLayerByBarycenter(
    layer: Layer,
    referenceLayer: Layer,
    adjacency: Map<string, Set<string>>,
    nodes: Map<string, LayoutNode>,
  ): void {
    const referencePositions = new Map<string, number>()
    referenceLayer.nodes.forEach((nodeId, index) => {
      referencePositions.set(nodeId, index)
    })

    // Calculate barycenter for each node
    const barycenters = layer.nodes.map((nodeId) => {
      const neighbors = adjacency.get(nodeId) || new Set()
      let sum = 0
      let count = 0

      neighbors.forEach((neighbor) => {
        const pos = referencePositions.get(neighbor)
        if (pos !== undefined) {
          sum += pos
          count++
        }
      })

      return {
        nodeId,
        barycenter: count > 0 ? sum / count : Infinity,
      }
    })

    // Sort by barycenter
    barycenters.sort((a, b) => a.barycenter - b.barycenter)

    // Update layer order and positions
    layer.nodes = barycenters.map((b) => b.nodeId)

    // Update x positions (縦向きレイアウト)
    const nodeSpacing = 200
    const layerWidth = (layer.nodes.length - 1) * nodeSpacing
    const startX = layerWidth / 2

    layer.nodes.forEach((nodeId, index) => {
      const node = nodes.get(nodeId)
      if (node) {
        node.position.x = index * nodeSpacing - startX
      }
    })
  }
}
