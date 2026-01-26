/**
 * Data Sources Store
 * Reactive state management for data sources
 */

import { writable, derived } from 'svelte/store'
import { api } from '$lib/api'
import type { DataSource, DataSourceInput } from '$lib/types'

interface DataSourcesState {
  items: DataSource[]
  loading: boolean
  error: string | null
}

function createDataSourcesStore() {
  const { subscribe, set, update } = writable<DataSourcesState>({
    items: [],
    loading: false,
    error: null,
  })

  return {
    subscribe,

    async load() {
      update((s) => ({ ...s, loading: true, error: null }))
      try {
        const items = await api.dataSources.list()
        update((s) => ({ ...s, items, loading: false }))
      } catch (e) {
        const error = e instanceof Error ? e.message : 'Failed to load data sources'
        update((s) => ({ ...s, error, loading: false }))
      }
    },

    async create(input: DataSourceInput) {
      const dataSource = await api.dataSources.create(input)
      update((s) => ({ ...s, items: [dataSource, ...s.items] }))
      return dataSource
    },

    async update(id: string, input: Partial<DataSourceInput>) {
      const dataSource = await api.dataSources.update(id, input)
      update((s) => ({
        ...s,
        items: s.items.map((ds) => (ds.id === id ? dataSource : ds)),
      }))
      return dataSource
    },

    async delete(id: string) {
      await api.dataSources.delete(id)
      update((s) => ({
        ...s,
        items: s.items.filter((ds) => ds.id !== id),
      }))
    },

    async test(id: string) {
      return api.dataSources.test(id)
    },
  }
}

export const dataSources = createDataSourcesStore()

// Derived store for easy access to items
export const dataSourcesList = derived(dataSources, ($ds) => $ds.items)
export const dataSourcesLoading = derived(dataSources, ($ds) => $ds.loading)
export const dataSourcesError = derived(dataSources, ($ds) => $ds.error)
