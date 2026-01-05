/**
 * Layout engine factory
 */

import type { LayoutEngine, LayoutEngineFactory } from './types'
import { BentoLayoutEngine } from './bento'
import { HierarchicalLayoutEngine } from './hierarchical'

export class DefaultLayoutEngineFactory implements LayoutEngineFactory {
  private engines: Map<string, () => LayoutEngine>
  
  constructor() {
    this.engines = new Map()
    
    // Register default engines
    this.register('bento', () => new BentoLayoutEngine())
    this.register('hierarchical', () => new HierarchicalLayoutEngine())
  }
  
  create(type: string): LayoutEngine {
    const factory = this.engines.get(type)
    if (!factory) {
      throw new Error(`Unknown layout engine: ${type}`)
    }
    
    return factory()
  }
  
  register(name: string, factory: (() => LayoutEngine) | LayoutEngine): void {
    if (typeof factory === 'function') {
      this.engines.set(name, factory)
    } else {
      this.engines.set(name, () => factory)
    }
  }
  
  list(): string[] {
    return Array.from(this.engines.keys())
  }
}

// Default instance
export const layoutEngineFactory = new DefaultLayoutEngineFactory()