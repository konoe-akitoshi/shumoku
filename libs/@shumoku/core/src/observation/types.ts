// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { ScopeFilter } from '../models/types.js'

/** Tuning knobs for `resolveNetwork()`. All optional. */
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
  /**
   * Registry entity ids for the project's own nodes and ports, as a snapshot's `entities`. The
   * project is registered like any source; with its entities the merge names every cluster's
   * entity, the project's included, and nobody has to look a node up again afterwards.
   */
  projectEntities?: { nodes: Record<string, string>; ports: Record<string, string> }
}

/** Quality of identity binding — diagnostic, not load-bearing. */
export type IdentityQuality = 'stable' | 'weak' | 'unbound'
