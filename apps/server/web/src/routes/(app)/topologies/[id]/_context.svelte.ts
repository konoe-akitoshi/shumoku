// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Topology-shell shared state. The diagram, sources, discovery,
 * mapping, settings, and resolved pages all live under
 * `/topologies/[id]/...` and want to read the *same* topology +
 * attached sources without each page re-fetching independently.
 *
 * The shell layout (`+layout.svelte`) loads once, drops the result
 * into this context, and child routes read via `useTopologyCtx()`.
 * Source edits are direct-apply: the Sources page mutates
 * `currentSources` in place after each granular add/update/remove
 * (no editable mirror, no dirty flag) — see topology-ui-ia.md.
 *
 * Why a class with `$state` instead of just runes at the layout
 * level: layout-script runes are only consumable in the layout
 * itself. Children get access via `getContext` only on plain
 * objects/classes. Wrapping every field in `$state` keeps the
 * reactivity working across the context boundary.
 */
import { getContext, setContext } from 'svelte'
import type { DataSource, Topology, TopologyDataSource } from '$lib/types'

const KEY = Symbol('topology-shell-ctx')

class TopologyCtx {
  topologyId = $state('')
  topology = $state<Topology | null>(null)
  loading = $state(true)
  error = $state('')

  /** Counts for the General-tab "Statistics" card. Reused by the
   *  layout's breadcrumb if/when we surface them there. */
  renderData = $state<{ nodeCount: number; edgeCount: number } | null>(null)

  /** Sources currently attached (Sources, Discovery, Mapping all read).
   *  The Sources page mutates this directly after each granular edit. */
  currentSources = $state<TopologyDataSource[]>([])

  /** Data-source catalogs for the +Add Source picker; cached because
   *  the Discovery page's per-card "owned by source X" lookup uses
   *  the same list. */
  topologyDataSources = $state<DataSource[]>([])
  metricsDataSources = $state<DataSource[]>([])

  getDataSource(id: string): DataSource | undefined {
    return (
      this.topologyDataSources.find((ds) => ds.id === id) ??
      this.metricsDataSources.find((ds) => ds.id === id)
    )
  }
}

export type { TopologyCtx }

export function createTopologyCtx(): TopologyCtx {
  const ctx = new TopologyCtx()
  setContext(KEY, ctx)
  return ctx
}

export function useTopologyCtx(): TopologyCtx {
  const ctx = getContext<TopologyCtx | undefined>(KEY)
  if (!ctx) {
    throw new Error(
      'useTopologyCtx() must be called inside a /topologies/[id]/* page (no shell context)',
    )
  }
  return ctx
}
