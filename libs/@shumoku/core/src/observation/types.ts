// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { NetworkGraph } from '../models/types.js'

/**
 * One source's observation at a point in time. The server's
 * `topology_observations` table stores one row per `SnapshotEntry`.
 * See `apps/server/docs/design/topology-foundation-schema.md § 2.1`.
 */
export interface SnapshotEntry {
  /** Source identifier — typically `data_sources.id`. */
  sourceId: string
  /** Unix ms — when the source captured this. */
  capturedAt: number
  /**
   * Snapshot status. The resolver consults this when deciding whether
   * absence should imply retraction:
   * - `'ok'` / `'partial'` / `'empty'`: presence is authoritative;
   *   `'failed'` is never used to retract.
   */
  status: 'ok' | 'partial' | 'failed' | 'empty'
  /** The observed graph. `null` only when `status === 'failed'`. */
  graph: NetworkGraph | null
  /**
   * How many of this source's recent runs have been `'failed'` in a row.
   * Used as the retraction hysteresis counter — the resolver only
   * considers retracting elements from this source after the threshold.
   */
  consecutiveFailures?: number
}

/** Tuning knobs for `resolve()`. All optional. */
export interface ResolveOptions {
  /**
   * Number of consecutive failed scans before a source's missing
   * observations count as retractions. Default `3`.
   */
  retractAfterMissedScans?: number
  /**
   * Observations older than this (ms) are ignored for conflict
   * detection. They still show in inspector history. Default 30 days.
   */
  staleThresholdMs?: number
}

/**
 * `resolve()` returns a regular `NetworkGraph`, just with `provenance`
 * filled on every entity. The type alias makes the contract obvious
 * at call sites.
 */
export type ResolvedGraph = NetworkGraph

/** Quality of identity binding — diagnostic, not load-bearing. */
export type IdentityQuality = 'stable' | 'weak' | 'unbound'
