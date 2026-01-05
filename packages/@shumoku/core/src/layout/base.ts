/**
 * Base layout engine implementation
 */

import type {
  LayoutEngine,
  LayoutOptions,
  LayoutResult,
  LayoutNode,
  LayoutEdge,
  LayoutModule,
  Position,
  Bounds,
} from './types'
import type { NetworkGraph, Device, Link } from '../models'

export abstract class BaseLayoutEngine implements LayoutEngine {
  abstract name: string
  abstract version: string

  abstract layout(
    graph: NetworkGraph,
    options?: LayoutOptions,
  ): LayoutResult | Promise<LayoutResult>

  /**
   * Default feature support
   */
  supports(feature: string): boolean {
    const supportedFeatures = [
      'nodes',
      'edges',
      'modules',
      'constraints',
      'animation',
      'manual-positions',
    ]
    return supportedFeatures.includes(feature)
  }

  /**
   * Default options
   */
  getDefaultOptions(): LayoutOptions {
    return {
      nodeSpacing: 250,
      layerSpacing: 400,
      modulePadding: 80,
      edgeRouting: 'straight',
      animate: true,
      respectManualPositions: true,
      seed: undefined,
      constraints: [],
    }
  }

  /**
   * Create initial node positions
   */
  protected createNodes(devices: Device[], options: LayoutOptions): Map<string, LayoutNode> {
    const nodes = new Map<string, LayoutNode>()
    const defaultSize = { width: 80, height: 60 }

    devices.forEach((device, index) => {
      const hasManualPosition =
        device.position?.x !== 'auto' &&
        device.position?.y !== 'auto' &&
        typeof device.position?.x === 'number' &&
        typeof device.position?.y === 'number'

      const position: Position =
        hasManualPosition && options.respectManualPositions
          ? { x: device.position!.x as number, y: device.position!.y as number }
          : { x: index * 100, y: 0 } // Initial position, will be updated by layout

      nodes.set(device.id, {
        id: device.id,
        position,
        size: device.style?.size || defaultSize,
        data: device,
      })
    })

    return nodes
  }

  /**
   * Create edges from links
   */
  protected createEdges(links: Link[]): Map<string, LayoutEdge> {
    const edges = new Map<string, LayoutEdge>()

    links.forEach((link) => {
      edges.set(link.id, {
        id: link.id,
        source: link.source.deviceId,
        target: link.target.deviceId,
        data: link,
      })
    })

    return edges
  }

  /**
   * Create module boundaries
   */
  protected createModules(
    modules: NetworkGraph['modules'],
    nodes: Map<string, LayoutNode>,
  ): Map<string, LayoutModule> | undefined {
    if (!modules?.length) return undefined

    const layoutModules = new Map<string, LayoutModule>()

    modules.forEach((module) => {
      const bounds = this.calculateModuleBounds(module.devices, nodes)
      if (bounds) {
        layoutModules.set(module.id, {
          id: module.id,
          bounds,
          children: module.devices,
          data: module,
        })
      }
    })

    return layoutModules.size > 0 ? layoutModules : undefined
  }

  /**
   * Calculate bounding box for a set of nodes
   */
  protected calculateModuleBounds(
    deviceIds: string[],
    nodes: Map<string, LayoutNode>,
    padding: number = 40,
  ): Bounds | null {
    const moduleNodes = deviceIds.map((id) => nodes.get(id)).filter(Boolean) as LayoutNode[]

    if (moduleNodes.length === 0) return null

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    moduleNodes.forEach((node) => {
      minX = Math.min(minX, node.position.x - node.size.width / 2)
      minY = Math.min(minY, node.position.y - node.size.height / 2)
      maxX = Math.max(maxX, node.position.x + node.size.width / 2)
      maxY = Math.max(maxY, node.position.y + node.size.height / 2)
    })

    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    }
  }

  /**
   * Calculate overall bounds
   */
  protected calculateBounds(nodes: Map<string, LayoutNode>): Bounds {
    if (nodes.size === 0) {
      return { x: 0, y: 0, width: 0, height: 0 }
    }

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    nodes.forEach((node) => {
      minX = Math.min(minX, node.position.x - node.size.width / 2)
      minY = Math.min(minY, node.position.y - node.size.height / 2)
      maxX = Math.max(maxX, node.position.x + node.size.width / 2)
      maxY = Math.max(maxY, node.position.y + node.size.height / 2)
    })

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    }
  }

  /**
   * Route edges with curved paths
   */
  protected routeEdges(
    edges: Map<string, LayoutEdge>,
    nodes: Map<string, LayoutNode>,
    routing: LayoutOptions['edgeRouting'] = 'curved',
  ): void {
    edges.forEach((edge) => {
      const source = nodes.get(edge.source)
      const target = nodes.get(edge.target)

      if (!source || !target) return

      if (routing === 'straight') {
        // Direct line
        edge.points = [source.position, target.position]
      } else if (routing === 'curved') {
        // Bezier curve
        const dx = target.position.x - source.position.x
        const dy = target.position.y - source.position.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        const curvature = Math.min(50, distance * 0.3)

        const midX = (source.position.x + target.position.x) / 2
        const midY = (source.position.y + target.position.y) / 2

        // Perpendicular offset for curve
        const perpX = (-dy / distance) * curvature
        const perpY = (dx / distance) * curvature

        edge.points = [source.position, { x: midX + perpX, y: midY + perpY }, target.position]
      } else if (routing === 'orthogonal') {
        // Improved orthogonal routing
        const dx = target.position.x - source.position.x
        const dy = target.position.y - source.position.y

        // デバイスのサイズを考慮したオフセット
        const sourceOffset = source.size.height / 2 + 20
        const targetOffset = target.size.height / 2 + 20

        if (Math.abs(dx) < 50) {
          // ほぼ垂直な接続
          edge.points = [
            source.position,
            {
              x: source.position.x,
              y: source.position.y + (dy > 0 ? sourceOffset : -sourceOffset),
            },
            {
              x: target.position.x,
              y: target.position.y + (dy > 0 ? -targetOffset : targetOffset),
            },
            target.position,
          ]
        } else {
          // 水平方向の接続を含む場合
          const midY = source.position.y + (dy > 0 ? sourceOffset : -sourceOffset)
          edge.points = [
            source.position,
            { x: source.position.x, y: midY },
            { x: target.position.x, y: midY },
            { x: target.position.x, y: target.position.y },
            target.position,
          ]
        }
      } else {
        // Default: orthogonal
        this.routeEdges(edges, nodes, 'orthogonal')
      }
    })
  }
}
