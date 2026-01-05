/**
 * Bento Grid Layout Engine
 * Creates aesthetically pleasing grid-based layouts
 */

import { BaseLayoutEngine } from './base'
import type { NetworkGraph } from '../models'
import type { LayoutOptions, LayoutResult, LayoutNode } from './types'

interface BentoGrid {
  columns: number
  rows: number
  cells: (string | null)[][]
}

interface BentoCell {
  column: number
  row: number
  colspan: number
  rowspan: number
  moduleId?: string
  devices: string[]
}

export class BentoLayoutEngine extends BaseLayoutEngine {
  name = 'bento'
  version = '1.0.0'
  
  async layout(graph: NetworkGraph, options?: LayoutOptions): Promise<LayoutResult> {
    const startTime = performance.now()
    const opts = { ...this.getDefaultOptions(), ...options }
    
    // Create initial nodes and edges
    const nodes = this.createNodes(graph.devices, opts)
    const edges = this.createEdges(graph.links)
    
    // Organize devices into cells
    const cells = this.organizeCells(graph, nodes)
    
    // Create optimal grid
    const grid = this.createOptimalGrid(cells)
    
    // Position cells in grid
    this.positionCells(cells, grid, nodes, opts)
    
    // Position devices within cells
    this.positionDevicesInCells(cells, nodes, opts)
    
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
        duration
      }
    }
  }
  
  /**
   * Organize devices into cells based on modules or auto-detection
   */
  private organizeCells(graph: NetworkGraph, _nodes: Map<string, LayoutNode>): BentoCell[] {
    const cells: BentoCell[] = []
    
    if (graph.modules?.length) {
      // Use defined modules
      graph.modules.forEach((module) => {
        const cell: BentoCell = {
          column: 0, // Will be set by grid placement
          row: 0,
          colspan: 1,
          rowspan: 1,
          moduleId: module.id,
          devices: module.devices
        }
        
        // Use layout hints if provided
        if (module.layout?.span) {
          cell.colspan = module.layout.span.columns || 1
          cell.rowspan = module.layout.span.rows || 1
        }
        
        cells.push(cell)
      })
      
      // Collect unassigned devices
      const assignedDevices = new Set(cells.flatMap(c => c.devices))
      const unassigned = graph.devices.filter(d => !assignedDevices.has(d.id))
      
      if (unassigned.length > 0) {
        cells.push({
          column: 0,
          row: 0,
          colspan: 1,
          rowspan: 1,
          devices: unassigned.map(d => d.id)
        })
      }
    } else {
      // Auto-detect groupings based on device roles/types
      const groups = this.autoDetectGroups(graph.devices)
      
      groups.forEach((devices) => {
        cells.push({
          column: 0,
          row: 0,
          colspan: 1,
          rowspan: 1,
          devices: devices.map(d => d.id)
        })
      })
    }
    
    return cells
  }
  
  /**
   * Auto-detect device groups based on characteristics
   */
  private autoDetectGroups(devices: NetworkGraph['devices']): NetworkGraph['devices'][] {
    const groups: NetworkGraph['devices'][] = []
    const grouped = new Set<string>()
    
    // Group by role
    const roleGroups = new Map<string, NetworkGraph['devices']>()
    devices.forEach(device => {
      if (device.role && !grouped.has(device.id)) {
        const group = roleGroups.get(device.role) || []
        group.push(device)
        roleGroups.set(device.role, group)
      }
    })
    
    // Add role groups with 2+ devices
    roleGroups.forEach(group => {
      if (group.length >= 2) {
        groups.push(group)
        group.forEach(d => grouped.add(d.id))
      }
    })
    
    // Group remaining by type
    const typeGroups = new Map<string, NetworkGraph['devices']>()
    devices.forEach(device => {
      if (!grouped.has(device.id)) {
        const group = typeGroups.get(device.type) || []
        group.push(device)
        typeGroups.set(device.type, group)
      }
    })
    
    // Add type groups
    typeGroups.forEach(group => {
      if (group.length >= 2) {
        groups.push(group)
      } else {
        // Single devices get their own cell
        groups.push(group)
      }
    })
    
    return groups
  }
  
  /**
   * Create optimal grid dimensions
   */
  private createOptimalGrid(cells: BentoCell[]): BentoGrid {
    // Calculate total area needed
    const totalArea = cells.reduce((sum, cell) => 
      sum + (cell.colspan * cell.rowspan), 0
    )
    
    // Find optimal grid dimensions (prefer golden ratio ~1.618)
    const targetRatio = 1.618
    let bestColumns = 1
    let bestRows = 1
    let bestRatioDiff = Infinity
    
    for (let cols = 1; cols <= Math.ceil(Math.sqrt(totalArea)); cols++) {
      const rows = Math.ceil(totalArea / cols)
      const ratio = cols / rows
      const ratioDiff = Math.abs(ratio - targetRatio)
      
      if (ratioDiff < bestRatioDiff) {
        bestRatioDiff = ratioDiff
        bestColumns = cols
        bestRows = rows
      }
    }
    
    // Create empty grid
    const grid: BentoGrid = {
      columns: bestColumns,
      rows: bestRows,
      cells: Array(bestRows).fill(null).map(() => Array(bestColumns).fill(null))
    }
    
    return grid
  }
  
  /**
   * Position cells within the grid using packing algorithm
   */
  private positionCells(
    cells: BentoCell[], 
    grid: BentoGrid, 
    _nodes: Map<string, LayoutNode>,
    _options: LayoutOptions
  ): void {
    // Sort cells by area (largest first) for better packing
    cells.sort((a, b) => 
      (b.colspan * b.rowspan) - (a.colspan * a.rowspan)
    )
    
    // Simple packing algorithm
    cells.forEach(cell => {
      let placed = false
      
      // Try to place in grid
      for (let row = 0; row <= grid.rows - cell.rowspan && !placed; row++) {
        for (let col = 0; col <= grid.columns - cell.colspan && !placed; col++) {
          // Check if space is available
          let canPlace = true
          for (let r = 0; r < cell.rowspan && canPlace; r++) {
            for (let c = 0; c < cell.colspan && canPlace; c++) {
              if (grid.cells[row + r]?.[col + c] !== null) {
                canPlace = false
              }
            }
          }
          
          if (canPlace) {
            // Place cell
            cell.column = col
            cell.row = row
            
            // Mark grid cells as occupied
            for (let r = 0; r < cell.rowspan; r++) {
              for (let c = 0; c < cell.colspan; c++) {
                if (grid.cells[row + r]) {
                  grid.cells[row + r][col + c] = cell.moduleId || 'cell'
                }
              }
            }
            
            placed = true
          }
        }
      }
      
      // If couldn't place, extend grid
      if (!placed) {
        // Add new row
        grid.rows++
        grid.cells.push(Array(grid.columns).fill(null))
        
        // Place at beginning of new row
        cell.column = 0
        cell.row = grid.rows - 1
        
        for (let c = 0; c < cell.colspan; c++) {
          grid.cells[cell.row][c] = cell.moduleId || 'cell'
        }
      }
    })
  }
  
  /**
   * Position devices within their cells
   */
  private positionDevicesInCells(
    cells: BentoCell[],
    nodes: Map<string, LayoutNode>,
    options: LayoutOptions
  ): void {
    const cellSize = 300 // Base cell size
    const padding = options.modulePadding || 40
    
    cells.forEach(cell => {
      const cellX = cell.column * cellSize + (cellSize * cell.colspan) / 2
      const cellY = cell.row * cellSize + (cellSize * cell.rowspan) / 2
      const cellWidth = cellSize * cell.colspan - padding * 2
      const cellHeight = cellSize * cell.rowspan - padding * 2
      
      const devices = cell.devices.map(id => nodes.get(id)).filter(Boolean) as LayoutNode[]
      
      if (devices.length === 0) return
      
      if (devices.length === 1) {
        // Center single device
        devices[0].position = { x: cellX, y: cellY }
      } else {
        // Arrange multiple devices in a grid within the cell
        const cols = Math.ceil(Math.sqrt(devices.length))
        const rows = Math.ceil(devices.length / cols)
        
        const deviceSpacingX = cellWidth / (cols + 1)
        const deviceSpacingY = cellHeight / (rows + 1)
        
        devices.forEach((device, index) => {
          const col = index % cols
          const row = Math.floor(index / cols)
          
          device.position = {
            x: cellX - cellWidth / 2 + deviceSpacingX * (col + 1),
            y: cellY - cellHeight / 2 + deviceSpacingY * (row + 1)
          }
        })
      }
    })
  }
}