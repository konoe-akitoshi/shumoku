/**
 * Topologies Store
 * Reactive state management for topologies
 */

import { derived, writable } from 'svelte/store'
import { api } from '$lib/api'
import type { MetricsMapping, Topology, TopologyInput } from '$lib/types'

interface TopologiesState {
  items: Topology[]
  loading: boolean
  error: string | null
}

function createTopologiesStore() {
  const { subscribe, update } = writable<TopologiesState>({
    items: [],
    loading: false,
    error: null,
  })

  async function applyShareToken(id: string, shareToken: string | undefined): Promise<Topology> {
    let updated: Topology | undefined
    update((s) => ({
      ...s,
      items: s.items.map((t) => {
        if (t.id !== id) return t
        updated = { ...t, shareToken }
        return updated
      }),
    }))
    if (updated) return updated
    // Item wasn't cached — fetch fresh, then ensure the just-applied shareToken
    // wins over whatever GET happened to return.
    const fetched = await api.topologies.get(id)
    const merged = { ...fetched, shareToken }
    update((s) => ({ ...s, items: [merged, ...s.items.filter((t) => t.id !== id)] }))
    return merged
  }

  return {
    subscribe,

    async load() {
      update((s) => ({ ...s, loading: true, error: null }))
      try {
        const items = await api.topologies.list()
        update((s) => ({ ...s, items, loading: false }))
      } catch (e) {
        const error = e instanceof Error ? e.message : 'Failed to load topologies'
        update((s) => ({ ...s, error, loading: false }))
      }
    },

    async get(id: string) {
      return api.topologies.get(id)
    },

    /** Insert or replace a topology in the cached list (used by detail pages). */
    upsert(topology: Topology) {
      update((s) => {
        const idx = s.items.findIndex((t) => t.id === topology.id)
        if (idx === -1) return { ...s, items: [topology, ...s.items] }
        const items = s.items.slice()
        items[idx] = topology
        return { ...s, items }
      })
    },

    async create(input: TopologyInput) {
      const topology = await api.topologies.create(input)
      update((s) => ({ ...s, items: [topology, ...s.items] }))
      return topology
    },

    async update(id: string, input: Partial<TopologyInput>) {
      const topology = await api.topologies.update(id, input)
      update((s) => ({
        ...s,
        items: s.items.map((t) => (t.id === id ? topology : t)),
      }))
      return topology
    },

    async delete(id: string) {
      await api.topologies.delete(id)
      update((s) => ({
        ...s,
        items: s.items.filter((t) => t.id !== id),
      }))
    },

    async updateMapping(id: string, mapping: MetricsMapping) {
      const topology = await api.topologies.updateMapping(id, mapping)
      update((s) => ({
        ...s,
        items: s.items.map((t) => (t.id === id ? topology : t)),
      }))
      return topology
    },

    async share(id: string): Promise<Topology> {
      const result = await api.topologies.share(id)
      return applyShareToken(id, result.shareToken)
    },

    async unshare(id: string): Promise<Topology> {
      await api.topologies.unshare(id)
      return applyShareToken(id, undefined)
    },

    async renderSvg(id: string) {
      return api.topologies.renderSvg(id)
    },

    async getGraph(id: string) {
      return api.topologies.getGraph(id)
    },
  }
}

export const topologies = createTopologiesStore()

// Derived stores for easy access
export const topologiesList = derived(topologies, ($t) => $t.items)
export const topologiesLoading = derived(topologies, ($t) => $t.loading)
export const topologiesError = derived(topologies, ($t) => $t.error)
