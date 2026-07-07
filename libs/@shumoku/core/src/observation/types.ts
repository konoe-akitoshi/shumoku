// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { NetworkGraph, ScopeFilter } from '../models/types.js'

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
   * Merge priority for this source — higher wins per field in `resolve()`.
   * Mirrors `topology_data_sources.priority`; defaults to `0` when omitted.
   * The intrinsic (project-owned) contribution always outranks snapshots
   * regardless of this value. Orthogonal to identity clustering (priority
   * decides the field winner, never which nodes are the same).
   */
  priority?: number
  /**
   * How many of this source's recent runs have been `'failed'` in a row.
   * Used as the retraction hysteresis counter — the resolver only
   * considers retracting elements from this source after the threshold.
   */
  consecutiveFailures?: number
  /**
   * Registry-assigned entity ids for this source's elements, as persisted in
   * `entity_element`. When present, `resolve()` uses these as first-class
   * cluster keys so that two representations of the same physical device (e.g.
   * a host row + an LLDP stub) that share an entity id are always folded —
   * even when their identity keys are disjoint. Without this field, resolve
   * falls back to pure identity-key clustering (existing behaviour, preserved
   * for backwards compatibility and for contexts without a registry).
   */
  entities?: {
    /** node local id → entity id */
    nodes: Record<string, string>
    /** `${nodeLocalId}:${portLocalId}` composite → entity id */
    ports: Record<string, string>
  }
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
  /**
   * Topology-level scope predicate. When it carries any `include`/`exclude`
   * criterion, resolve drops every node cluster that doesn't satisfy it
   * (operator-curated intrinsic nodes are always kept). Absent / empty → no
   * topology-level scoping. Orthogonal to, and applied after, region scope.
   */
  scope?: ScopeFilter
}

/**
 * `resolve()` returns a regular `NetworkGraph`, just with `provenance`
 * filled on every entity. The type alias makes the contract obvious
 * at call sites.
 */
export type ResolvedGraph = NetworkGraph

/** Quality of identity binding — diagnostic, not load-bearing. */
export type IdentityQuality = 'stable' | 'weak' | 'unbound'
