/**
 * Layout engine types
 */

import type { NetworkGraph, Device, Link, Module } from '../models'

export interface Position {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export interface LayoutNode {
  id: string
  position: Position
  size: Size
  data: Device
}

export interface LayoutEdge {
  id: string
  source: string
  target: string
  points?: Position[]
  data: Link
}

export interface LayoutModule {
  id: string
  bounds: Bounds
  children: string[]
  data: Module
}

export interface LayoutResult {
  /**
   * Positioned nodes
   */
  nodes: Map<string, LayoutNode>
  
  /**
   * Edge routing
   */
  edges: Map<string, LayoutEdge>
  
  /**
   * Module boundaries
   */
  modules?: Map<string, LayoutModule>
  
  /**
   * Overall bounds
   */
  bounds: Bounds
  
  /**
   * Layout metadata
   */
  metadata?: {
    algorithm: string
    duration: number
    iterations?: number
  }
}

export interface LayoutOptions {
  /**
   * Node spacing
   */
  nodeSpacing?: number
  
  /**
   * Layer spacing (for hierarchical)
   */
  layerSpacing?: number
  
  /**
   * Module padding
   */
  modulePadding?: number
  
  /**
   * Edge routing
   */
  edgeRouting?: 'straight' | 'orthogonal' | 'curved'
  
  /**
   * Animation support
   */
  animate?: boolean
  
  /**
   * Respect manual positions
   */
  respectManualPositions?: boolean
  
  /**
   * Random seed for deterministic layouts
   */
  seed?: number
  
  /**
   * Custom constraints
   */
  constraints?: LayoutConstraint[]
}

export interface LayoutConstraint {
  type: 'alignment' | 'distance' | 'order' | 'group'
  nodes: string[]
  options?: Record<string, unknown>
}

export interface LayoutEngine {
  /**
   * Engine name
   */
  name: string
  
  /**
   * Engine version
   */
  version: string
  
  /**
   * Compute layout
   */
  layout(graph: NetworkGraph, options?: LayoutOptions): LayoutResult | Promise<LayoutResult>
  
  /**
   * Check if engine supports feature
   */
  supports(feature: string): boolean
  
  /**
   * Get default options
   */
  getDefaultOptions(): LayoutOptions
}

export interface LayoutEngineFactory {
  /**
   * Create layout engine instance
   */
  create(type: 'hierarchical' | 'bento' | 'force' | string): LayoutEngine
  
  /**
   * Register custom engine
   */
  register(name: string, engine: LayoutEngine): void
  
  /**
   * List available engines
   */
  list(): string[]
}