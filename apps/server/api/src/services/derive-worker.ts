// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Derivation worker — runs the CPU-heavy half of a topology parse
 * (resolve → display filter → drawing, see `derive.ts`) in a Bun Worker so
 * the serving event loop stays responsive. A large drawing can take minutes;
 * on the main thread that froze every API request (the "Loading topology..."
 * hang after a big Sync).
 *
 * Pure compute: all inputs arrive via postMessage (no DB access here), the
 * result goes back the same way.
 *
 * Protocol (worker → host):
 *   { type: 'progress', stage: 'resolve' | 'layout' }
 *   { type: 'result', graph, scene, observation, attributes }
 *   { type: 'error', message }
 */

import { type DeriveRequest, derive } from './derive.js'

export type { DeriveRequest }

declare var self: Worker

self.onmessage = (event: MessageEvent) => {
  const req = event.data as DeriveRequest
  try {
    const result = derive(req, (stage) => self.postMessage({ type: 'progress', stage }))
    self.postMessage({ type: 'result', ...result })
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    })
  }
}
