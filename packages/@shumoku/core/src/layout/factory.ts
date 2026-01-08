/**
 * Layout engine factory
 */

import type { LayoutEngine, LayoutEngineFactory } from './types'
import { LocationBasedLayout } from './location-based'

export class DefaultLayoutEngineFactory implements LayoutEngineFactory {
  private engines: Map<string, () => LayoutEngine>

  constructor() {
    this.engines = new Map()

    // Register default engine
    this.register('location-based', () => new LocationBasedLayout())
    // Alias for convenience
    this.register('default', () => new LocationBasedLayout())
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
