// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Derivation worker — runs the CPU-heavy half of a topology parse
 * (resolve → display filter → icon dimensions → layout) in a Bun Worker so
 * the serving event loop stays responsive. A large layout can take minutes;
 * on the main thread that froze every API request (the "Loading topology..."
 * hang after a big Sync).
 *
 * Pure compute: all inputs arrive via postMessage (no DB access here), the
 * result goes back the same way. Maps survive the structured clone.
 *
 * Protocol (worker → host):
 *   { type: 'progress', stage: 'resolve' | 'icons' | 'layout' }
 *   { type: 'result', graph, layout, resolved, iconDimensions }
 *   { type: 'error', message }
 */

import {
  computeNetworkLayout,
  type NetworkGraph,
  resolve as resolveObservations,
  type ScopeFilter,
  type SnapshotEntry,
} from '@shumoku/core'
import { collectIconUrls, resolveAllIconDimensions } from '@shumoku/renderer-svg'
import { filterDisconnected } from './display-filter.js'

export interface DeriveRequest {
  authored: NetworkGraph
  snapshots: SnapshotEntry[]
  scope?: ScopeFilter
  hideDisconnected: boolean
}

declare var self: Worker

self.onmessage = async (event: MessageEvent) => {
  const req = event.data as DeriveRequest
  try {
    self.postMessage({ type: 'progress', stage: 'resolve' })
    const resolvedGraph = resolveObservations(req.authored, req.snapshots, { scope: req.scope })
    const graph = req.hideDisconnected ? filterDisconnected(resolvedGraph) : resolvedGraph

    self.postMessage({ type: 'progress', stage: 'icons' })
    let iconDimensions = new Map<string, { width: number; height: number }>()
    const iconUrls = collectIconUrls(graph)
    if (iconUrls.length > 0) {
      try {
        iconDimensions = await resolveAllIconDimensions(iconUrls)
      } catch (err) {
        console.warn('[derive-worker] Failed to resolve icon dimensions:', err)
      }
    }

    self.postMessage({ type: 'progress', stage: 'layout' })
    const { resolved, layout } = await computeNetworkLayout(graph)

    self.postMessage({ type: 'result', graph, layout, resolved, iconDimensions })
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    })
  }
}
