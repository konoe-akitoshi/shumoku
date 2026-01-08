/**
 * Location-based Layout Engine
 * Groups devices by physical location (rooms, racks, etc.)
 *
 * Design: Content-first sizing
 * 1. Calculate required size for each location based on device count
 * 2. Position locations in a grid
 * 3. Position devices within their locations
 */

import { BaseLayoutEngine } from './base'
import type { NetworkGraph, Location, Device } from '../models'
import type { LayoutOptions, LayoutResult, LayoutNode, LayoutLocation, LayoutEdge } from './types'

export interface LocationBasedOptions extends LayoutOptions {
  /**
   * Spacing between locations
   */
  locationSpacing?: number

  /**
   * Padding inside each location
   */
  locationPadding?: number

  /**
   * Number of columns for device grid inside locations
   */
  deviceColumns?: number

  /**
   * Minimum location size
   */
  minLocationSize?: {
    width: number
    height: number
  }
}

interface LocationBounds {
  x: number
  y: number
  width: number
  height: number
}

export class LocationBasedLayout extends BaseLayoutEngine {
  name = 'location-based'
  version = '1.0.0'

  getDefaultOptions(): LayoutOptions {
    return {
      nodeSpacing: 60,
      nodeSize: 60,
      edgeRouting: 'straight',
    }
  }

  async layout(graph: NetworkGraph, options?: LocationBasedOptions): Promise<LayoutResult> {
    const startTime = performance.now()
    const opts = {
      ...this.getDefaultOptions(),
      ...options,
      locationSpacing: options?.locationSpacing ?? 40,
      locationPadding: options?.locationPadding ?? 40,
      deviceColumns: options?.deviceColumns ?? 3,
      minLocationSize: options?.minLocationSize ?? { width: 200, height: 150 },
    }

    const nodeSize = opts.nodeSize ?? 60
    const nodeSpacing = opts.nodeSpacing ?? 60
    const cellSize = nodeSize + nodeSpacing

    // Create initial nodes
    const nodes = this.createNodes(graph.devices, opts)
    const edges = this.createEdges(graph.links)

    // Layout locations for result
    let layoutLocations: Map<string, LayoutLocation> | undefined

    // Position devices based on their location
    if (graph.locations && graph.locations.length > 0) {
      // Step 1: Calculate required size for each location based on device count
      const locationSizes = this.calculateLocationSizes(
        graph.locations,
        opts.deviceColumns,
        cellSize,
        opts.locationPadding,
        opts.minLocationSize,
      )

      // Step 2: Position locations in a grid layout
      const locationPositions = this.positionLocations(
        graph.locations,
        locationSizes,
        opts.locationSpacing,
      )

      // Step 3: Position devices within their locations
      for (const location of graph.locations) {
        const bounds = locationPositions.get(location.id)
        if (!bounds) continue

        const deviceIds = location.deviceIds || []
        if (deviceIds.length === 0) continue

        this.positionDevicesInLocation(
          deviceIds,
          nodes,
          bounds,
          opts.locationPadding,
          nodeSize,
          cellSize,
          opts.deviceColumns,
        )
      }

      // Step 4: Build layout locations for the result
      layoutLocations = new Map()
      for (const location of graph.locations) {
        const bounds = locationPositions.get(location.id)
        if (!bounds) continue

        layoutLocations.set(location.id, {
          id: location.id,
          name: location.name,
          bounds,
          style: location.style,
        })
      }
    }

    // Route edges with cross-location awareness
    if (layoutLocations && layoutLocations.size > 0) {
      this.routeEdgesWithLocations(edges, nodes, layoutLocations, graph.devices)
    } else {
      this.routeEdges(edges, nodes, opts.edgeRouting)
    }

    // Create module boundaries (if any)
    const modules = this.createModules(graph.modules, nodes)

    // Calculate bounds (include locations in calculation)
    const bounds = this.calculateBoundsWithLocations(nodes, layoutLocations)

    const duration = performance.now() - startTime

    return {
      nodes,
      edges,
      modules,
      locations: layoutLocations,
      bounds,
      metadata: {
        algorithm: this.name,
        duration,
      },
    }
  }

  /**
   * Calculate bounds including both nodes and locations
   */
  private calculateBoundsWithLocations(
    nodes: Map<string, LayoutNode>,
    locations?: Map<string, LayoutLocation>,
  ): { x: number; y: number; width: number; height: number } {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    // Include nodes
    nodes.forEach((node) => {
      const halfWidth = node.size.width / 2
      const halfHeight = node.size.height / 2
      minX = Math.min(minX, node.position.x - halfWidth)
      minY = Math.min(minY, node.position.y - halfHeight)
      maxX = Math.max(maxX, node.position.x + halfWidth)
      maxY = Math.max(maxY, node.position.y + halfHeight)
    })

    // Include locations
    if (locations) {
      locations.forEach((loc) => {
        minX = Math.min(minX, loc.bounds.x)
        minY = Math.min(minY, loc.bounds.y - 30) // Account for label above
        maxX = Math.max(maxX, loc.bounds.x + loc.bounds.width)
        maxY = Math.max(maxY, loc.bounds.y + loc.bounds.height)
      })
    }

    // Add padding
    const padding = 50
    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    }
  }

  /**
   * Calculate required size for each location based on device count
   */
  private calculateLocationSizes(
    locations: Location[],
    columns: number,
    cellSize: number,
    padding: number,
    minSize: { width: number; height: number },
  ): Map<string, { width: number; height: number }> {
    const sizes = new Map<string, { width: number; height: number }>()

    for (const location of locations) {
      const deviceCount = location.deviceIds?.length || 0

      if (deviceCount === 0) {
        // Empty location gets minimum size
        sizes.set(location.id, { ...minSize })
        continue
      }

      // Calculate grid dimensions
      const cols = Math.min(columns, deviceCount)
      const rows = Math.ceil(deviceCount / cols)

      // Calculate required size to fit all devices
      const contentWidth = cols * cellSize
      const contentHeight = rows * cellSize
      const requiredWidth = contentWidth + padding * 2
      const requiredHeight = contentHeight + padding * 2

      // Always ensure the location is large enough for devices
      // Use max of (explicit size, required size, minimum size)
      const explicitWidth = location.position?.width ?? 0
      const explicitHeight = location.position?.height ?? 0
      const width = Math.max(requiredWidth, explicitWidth, minSize.width)
      const height = Math.max(requiredHeight, explicitHeight, minSize.height)

      sizes.set(location.id, { width, height })
    }

    return sizes
  }

  /**
   * Position locations in a grid layout
   */
  private positionLocations(
    locations: Location[],
    sizes: Map<string, { width: number; height: number }>,
    spacing: number,
  ): Map<string, LocationBounds> {
    const positions = new Map<string, LocationBounds>()

    // Get root locations (no parent) - these are the ones we position
    const rootLocations = locations.filter((loc) => !loc.parentId)

    // Use a simple row-based layout where each row can have different heights
    let currentX = 0
    let currentY = 0
    let rowMaxHeight = 0
    const maxRowWidth = 1800 // Maximum width before wrapping to next row

    for (const location of rootLocations) {
      const size = sizes.get(location.id) || { width: 200, height: 150 }

      // Check if we need to wrap to next row
      if (currentX > 0 && currentX + size.width > maxRowWidth) {
        currentX = 0
        currentY += rowMaxHeight + spacing
        rowMaxHeight = 0
      }

      // Use explicit position if provided, otherwise use calculated position
      const x = location.position?.x ?? currentX
      const y = location.position?.y ?? currentY

      positions.set(location.id, {
        x,
        y,
        width: size.width,
        height: size.height,
      })

      // Update position for next location (only if we're using calculated positions)
      if (location.position?.x === undefined) {
        currentX += size.width + spacing
        rowMaxHeight = Math.max(rowMaxHeight, size.height)
      }
    }

    return positions
  }

  /**
   * Position devices within a location using a grid layout
   */
  private positionDevicesInLocation(
    deviceIds: string[],
    nodes: Map<string, LayoutNode>,
    bounds: LocationBounds,
    padding: number,
    _nodeSize: number,
    cellSize: number,
    maxColumns: number,
  ): void {
    const deviceCount = deviceIds.length
    const cols = Math.min(maxColumns, deviceCount)

    // Center the grid within the location
    const gridWidth = cols * cellSize

    const startX = bounds.x + (bounds.width - gridWidth) / 2 + cellSize / 2
    const startY = bounds.y + padding + cellSize / 2

    deviceIds.forEach((deviceId, index) => {
      const node = nodes.get(deviceId)
      if (node) {
        const col = index % cols
        const row = Math.floor(index / cols)

        node.position = {
          x: startX + col * cellSize,
          y: startY + row * cellSize,
        }
      }
    })
  }

  /**
   * Route edges with awareness of location boundaries
   * Cross-location links are routed through location edges
   */
  private routeEdgesWithLocations(
    edges: Map<string, LayoutEdge>,
    nodes: Map<string, LayoutNode>,
    locations: Map<string, LayoutLocation>,
    devices: Device[],
  ): void {
    // Build device -> locationId map
    const deviceLocationMap = new Map<string, string>()
    for (const device of devices) {
      const locationId = device.metadata?.locationId as string | undefined
      if (locationId) {
        deviceLocationMap.set(device.id, locationId)
      }
    }

    edges.forEach((edge) => {
      const sourceNode = nodes.get(edge.source)
      const targetNode = nodes.get(edge.target)

      if (!sourceNode || !targetNode) {
        return
      }

      const sourceLocationId = deviceLocationMap.get(edge.source)
      const targetLocationId = deviceLocationMap.get(edge.target)

      // Check if this is a cross-location link
      const isCrossLocation =
        sourceLocationId && targetLocationId && sourceLocationId !== targetLocationId

      if (isCrossLocation) {
        const sourceLocation = locations.get(sourceLocationId)
        const targetLocation = locations.get(targetLocationId)

        if (sourceLocation && targetLocation) {
          // Route through location boundaries
          const points = this.calculateCrossLocationRoute(
            sourceNode.position,
            targetNode.position,
            sourceLocation.bounds,
            targetLocation.bounds,
          )
          edge.points = points

          // Mark this edge as cross-location for rendering
          edge.data = {
            ...edge.data,
            metadata: {
              ...edge.data.metadata,
              crossLocation: true,
              sourceLocationId,
              targetLocationId,
            },
          }
        }
      } else {
        // Curved routing for internal links
        edge.points = this.calculateCurvedRoute(
          sourceNode.position,
          targetNode.position,
        )
        // Mark as curved for renderer
        edge.data = {
          ...edge.data,
          metadata: {
            ...edge.data.metadata,
            curved: true,
          },
        }
      }
    })
  }

  /**
   * Calculate curved route for internal links (Bezier curve)
   * Returns [start, control1, control2, end] for cubic bezier
   */
  private calculateCurvedRoute(
    sourcePos: { x: number; y: number },
    targetPos: { x: number; y: number },
  ): Array<{ x: number; y: number }> {
    const dx = targetPos.x - sourcePos.x
    const dy = targetPos.y - sourcePos.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    // Control point offset (curve intensity)
    const curvature = Math.min(distance * 0.3, 50)

    // Determine curve direction based on relative positions
    let ctrl1: { x: number; y: number }
    let ctrl2: { x: number; y: number }

    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal-ish: curve vertically
      const curveDir = dy >= 0 ? -1 : 1
      ctrl1 = {
        x: sourcePos.x + dx * 0.3,
        y: sourcePos.y + curveDir * curvature,
      }
      ctrl2 = {
        x: sourcePos.x + dx * 0.7,
        y: targetPos.y + curveDir * curvature,
      }
    } else {
      // Vertical-ish: curve horizontally
      const curveDir = dx >= 0 ? -1 : 1
      ctrl1 = {
        x: sourcePos.x + curveDir * curvature,
        y: sourcePos.y + dy * 0.3,
      }
      ctrl2 = {
        x: targetPos.x + curveDir * curvature,
        y: sourcePos.y + dy * 0.7,
      }
    }

    return [
      { x: sourcePos.x, y: sourcePos.y },
      ctrl1,
      ctrl2,
      { x: targetPos.x, y: targetPos.y },
    ]
  }

  /**
   * Calculate route for cross-location link
   * Routes through gaps between locations using orthogonal paths
   */
  private calculateCrossLocationRoute(
    sourcePos: { x: number; y: number },
    targetPos: { x: number; y: number },
    sourceBounds: LocationBounds,
    targetBounds: LocationBounds,
  ): Array<{ x: number; y: number }> {
    const points: Array<{ x: number; y: number }> = []

    // Start from device
    points.push({ x: sourcePos.x, y: sourcePos.y })

    // Calculate the gap midpoints
    const sourceRight = sourceBounds.x + sourceBounds.width
    const sourceBottom = sourceBounds.y + sourceBounds.height
    const targetRight = targetBounds.x + targetBounds.width
    const targetBottom = targetBounds.y + targetBounds.height

    // Determine relative positions
    const isTargetRight = targetBounds.x > sourceRight
    const isTargetLeft = targetRight < sourceBounds.x
    const isTargetBelow = targetBounds.y > sourceBottom
    const isTargetAbove = targetBottom < sourceBounds.y

    if (isTargetRight && !isTargetBelow && !isTargetAbove) {
      // Directly to the right - horizontal route
      const gapX = (sourceRight + targetBounds.x) / 2
      points.push({ x: sourceRight, y: sourcePos.y })
      points.push({ x: gapX, y: sourcePos.y })
      points.push({ x: gapX, y: targetPos.y })
      points.push({ x: targetBounds.x, y: targetPos.y })
    } else if (isTargetLeft && !isTargetBelow && !isTargetAbove) {
      // Directly to the left - horizontal route
      const gapX = (targetRight + sourceBounds.x) / 2
      points.push({ x: sourceBounds.x, y: sourcePos.y })
      points.push({ x: gapX, y: sourcePos.y })
      points.push({ x: gapX, y: targetPos.y })
      points.push({ x: targetRight, y: targetPos.y })
    } else if (isTargetBelow) {
      // Target is below - route through bottom gap
      const gapY = (sourceBottom + targetBounds.y) / 2
      // Exit from bottom
      points.push({ x: sourcePos.x, y: sourceBottom })
      points.push({ x: sourcePos.x, y: gapY })
      points.push({ x: targetPos.x, y: gapY })
      points.push({ x: targetPos.x, y: targetBounds.y })
    } else if (isTargetAbove) {
      // Target is above - route through top gap
      const gapY = (targetBottom + sourceBounds.y) / 2
      // Exit from top
      points.push({ x: sourcePos.x, y: sourceBounds.y })
      points.push({ x: sourcePos.x, y: gapY })
      points.push({ x: targetPos.x, y: gapY })
      points.push({ x: targetPos.x, y: targetBottom })
    } else {
      // Diagonal or overlapping - use L-shaped route through gap
      // Go out the side closest to target, then down/up
      if (targetBounds.x > sourceBounds.x) {
        const gapX = (sourceRight + targetBounds.x) / 2
        points.push({ x: sourceRight, y: sourcePos.y })
        points.push({ x: gapX, y: sourcePos.y })
        points.push({ x: gapX, y: targetPos.y })
        points.push({ x: targetBounds.x, y: targetPos.y })
      } else {
        const gapX = (targetRight + sourceBounds.x) / 2
        points.push({ x: sourceBounds.x, y: sourcePos.y })
        points.push({ x: gapX, y: sourcePos.y })
        points.push({ x: gapX, y: targetPos.y })
        points.push({ x: targetRight, y: targetPos.y })
      }
    }

    // End at device
    points.push({ x: targetPos.x, y: targetPos.y })

    return points
  }
}
