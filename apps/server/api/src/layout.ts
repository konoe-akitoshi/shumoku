/**
 * Bun-compatible layout wrapper
 * Uses web-worker package to make elkjs work in Bun
 */

import { createRequire } from 'node:module'
import {
  HierarchicalLayout,
  type HierarchicalLayoutOptions,
  type IconDimensions,
  type LayoutResult,
  type NetworkGraph,
} from '@shumoku/core'
import ELKApi from 'elkjs/lib/elk-api.js'
import Worker from 'web-worker'

// Get the path to elk-worker.min.js
const require = createRequire(import.meta.url)
const elkWorkerPath = require.resolve('elkjs/lib/elk-worker.min.js')

/**
 * Singleton ELK instance to avoid creating new Workers on every layout call
 * Workers are expensive resources and should be reused
 */
let elkInstance: InstanceType<typeof ELKApi> | null = null

function getElkInstance() {
  if (!elkInstance) {
    elkInstance = new ELKApi({
      workerFactory: () => new Worker(elkWorkerPath) as never,
    })
  }
  return elkInstance
}

/**
 * Bun-compatible HierarchicalLayout wrapper
 * Creates a HierarchicalLayout with a Bun-compatible ELK instance (singleton)
 */
export class BunHierarchicalLayout {
  private options: Omit<HierarchicalLayoutOptions, 'elk'>

  constructor(options?: Omit<HierarchicalLayoutOptions, 'elk'>) {
    this.options = options ?? {}
  }

  /**
   * Compute layout (wrapper for HierarchicalLayout.layout)
   */
  layout(graph: NetworkGraph, iconDimensions?: Map<string, IconDimensions>): LayoutResult {
    const layoutInstance = new HierarchicalLayout({
      ...this.options,
      iconDimensions,
      elk: getElkInstance(),
    })
    return layoutInstance.layout(graph)
  }

  /**
   * Compute layout asynchronously (wrapper for HierarchicalLayout.layoutAsync)
   */
  layoutAsync(
    graph: NetworkGraph,
    iconDimensions?: Map<string, IconDimensions>,
  ): Promise<LayoutResult> {
    const layoutInstance = new HierarchicalLayout({
      ...this.options,
      iconDimensions,
      elk: getElkInstance(),
    })
    return layoutInstance.layoutAsync(graph)
  }
}
