/**
 * Topologies Store
 * Reactive state management for topologies
 */

import { writable, derived } from 'svelte/store'
import { api } from '$lib/api'
import type { Topology, TopologyInput, MetricsMapping } from '$lib/types'

interface TopologiesState {
  items: Topology[]
  loading: boolean
  error: string | null
}

function createTopologiesStore() {
  const { subscribe, set, update } = writable<TopologiesState>({
    items: [],
    loading: false,
    error: null,
  })

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

    async renderSvg(id: string) {
      return api.topologies.renderSvg(id)
    },
  }
}

export const topologies = createTopologiesStore()

// Derived stores for easy access
export const topologiesList = derived(topologies, ($t) => $t.items)
export const topologiesLoading = derived(topologies, ($t) => $t.loading)
export const topologiesError = derived(topologies, ($t) => $t.error)
