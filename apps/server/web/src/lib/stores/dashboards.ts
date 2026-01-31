/**
 * Dashboard Store
 * Manages dashboard state and CRUD operations
 */

import { writable, derived, get } from 'svelte/store'
import { api } from '$lib/api'
import type { Dashboard, DashboardLayout, WidgetInstance, WidgetPosition } from '$lib/types'
import { nanoid } from '$lib/utils/id'

// Store state
interface DashboardState {
  items: Dashboard[]
  current: Dashboard | null
  currentLayout: DashboardLayout | null
  savedLayout: DashboardLayout | null // Snapshot before editing
  loading: boolean
  error: string | null
  editMode: boolean
}

const initialState: DashboardState = {
  items: [],
  current: null,
  currentLayout: null,
  savedLayout: null,
  loading: false,
  error: null,
  editMode: false,
}

// Default layout configuration
const defaultLayout: DashboardLayout = {
  columns: 12,
  rowHeight: 100,
  margin: 8,
  widgets: [],
}

function parseDashboardLayout(dashboard: Dashboard): DashboardLayout {
  try {
    return JSON.parse(dashboard.layoutJson) as DashboardLayout
  } catch {
    return { ...defaultLayout }
  }
}

function createDashboardStore() {
  const { subscribe, set, update } = writable<DashboardState>(initialState)

  return {
    subscribe,

    /**
     * Load all dashboards
     */
    load: async () => {
      update((s) => ({ ...s, loading: true, error: null }))
      try {
        const items = await api.dashboards.list()
        update((s) => ({ ...s, items, loading: false }))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load dashboards'
        update((s) => ({ ...s, error: message, loading: false }))
      }
    },

    /**
     * Get a single dashboard by ID
     */
    get: async (id: string) => {
      update((s) => ({ ...s, loading: true, error: null }))
      try {
        const dashboard = await api.dashboards.get(id)
        const layout = parseDashboardLayout(dashboard)
        update((s) => ({
          ...s,
          current: dashboard,
          currentLayout: layout,
          loading: false,
        }))
        return dashboard
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load dashboard'
        update((s) => ({ ...s, error: message, loading: false }))
        return null
      }
    },

    /**
     * Create a new dashboard
     */
    create: async (name: string) => {
      update((s) => ({ ...s, loading: true, error: null }))
      try {
        const dashboard = await api.dashboards.create({
          name,
          layoutJson: JSON.stringify(defaultLayout),
        })
        update((s) => ({
          ...s,
          items: [dashboard, ...s.items],
          loading: false,
        }))
        return dashboard
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create dashboard'
        update((s) => ({ ...s, error: message, loading: false }))
        return null
      }
    },

    /**
     * Save the current dashboard
     */
    save: async () => {
      const state = get({ subscribe })
      if (!state.current || !state.currentLayout) {
        return false
      }

      update((s) => ({ ...s, loading: true, error: null }))
      try {
        const layoutJson = JSON.stringify(state.currentLayout)
        const updated = await api.dashboards.update(state.current.id, { layoutJson })
        update((s) => ({
          ...s,
          current: updated,
          items: s.items.map((d) => (d.id === updated.id ? updated : d)),
          savedLayout: null, // Clear snapshot after successful save
          loading: false,
        }))
        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save dashboard'
        update((s) => ({ ...s, error: message, loading: false }))
        return false
      }
    },

    /**
     * Delete a dashboard
     */
    delete: async (id: string) => {
      update((s) => ({ ...s, loading: true, error: null }))
      try {
        await api.dashboards.delete(id)
        update((s) => ({
          ...s,
          items: s.items.filter((d) => d.id !== id),
          current: s.current?.id === id ? null : s.current,
          currentLayout: s.current?.id === id ? null : s.currentLayout,
          loading: false,
        }))
        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete dashboard'
        update((s) => ({ ...s, error: message, loading: false }))
        return false
      }
    },

    /**
     * Enter edit mode (saves snapshot for cancel)
     */
    setEditMode: (enabled: boolean) => {
      update((s) => {
        if (enabled && s.currentLayout) {
          // Save snapshot when entering edit mode
          return {
            ...s,
            editMode: true,
            savedLayout: JSON.parse(JSON.stringify(s.currentLayout)),
          }
        }
        return { ...s, editMode: enabled }
      })
    },

    /**
     * Cancel edit mode and restore original layout
     */
    cancelEdit: () => {
      update((s) => {
        if (s.savedLayout) {
          return {
            ...s,
            editMode: false,
            currentLayout: s.savedLayout,
            savedLayout: null,
          }
        }
        return { ...s, editMode: false }
      })
    },

    /**
     * Add a new widget to the current dashboard
     */
    addWidget: (
      type: string,
      config: Record<string, unknown> = {},
      size?: { w: number; h: number },
    ) => {
      update((s) => {
        if (!s.currentLayout) return s

        const defaultSizes: Record<string, { w: number; h: number }> = {
          topology: { w: 6, h: 4 },
          'metrics-gauge': { w: 3, h: 2 },
          'health-status': { w: 3, h: 2 },
          'datasource-status': { w: 4, h: 2 },
        }

        const widgetSize = size || defaultSizes[type] || { w: 4, h: 3 }

        const widget: WidgetInstance = {
          id: nanoid(),
          type,
          config,
          position: {
            x: 0,
            y: findNextY(s.currentLayout.widgets),
            ...widgetSize,
          },
        }

        return {
          ...s,
          currentLayout: {
            ...s.currentLayout,
            widgets: [...s.currentLayout.widgets, widget],
          },
        }
      })
    },

    /**
     * Remove a widget from the current dashboard
     */
    removeWidget: (widgetId: string) => {
      update((s) => {
        if (!s.currentLayout) return s
        return {
          ...s,
          currentLayout: {
            ...s.currentLayout,
            widgets: s.currentLayout.widgets.filter((w) => w.id !== widgetId),
          },
        }
      })
    },

    /**
     * Update a widget's position
     */
    updateWidgetPosition: (widgetId: string, position: WidgetPosition) => {
      update((s) => {
        if (!s.currentLayout) return s
        return {
          ...s,
          currentLayout: {
            ...s.currentLayout,
            widgets: s.currentLayout.widgets.map((w) =>
              w.id === widgetId ? { ...w, position } : w,
            ),
          },
        }
      })
    },

    /**
     * Update a widget's config
     */
    updateWidgetConfig: (widgetId: string, config: Record<string, unknown>) => {
      update((s) => {
        if (!s.currentLayout) return s
        return {
          ...s,
          currentLayout: {
            ...s.currentLayout,
            widgets: s.currentLayout.widgets.map((w) =>
              w.id === widgetId ? { ...w, config: { ...w.config, ...config } } : w,
            ),
          },
        }
      })
    },

    /**
     * Batch update widget positions (for grid drag/resize)
     */
    updateWidgetPositions: (positions: Array<{ id: string; position: WidgetPosition }>) => {
      update((s) => {
        if (!s.currentLayout) return s
        const positionMap = new Map(positions.map((p) => [p.id, p.position]))
        return {
          ...s,
          currentLayout: {
            ...s.currentLayout,
            widgets: s.currentLayout.widgets.map((w) => {
              const newPos = positionMap.get(w.id)
              return newPos ? { ...w, position: newPos } : w
            }),
          },
        }
      })
    },

    /**
     * Set layout directly (for shared/read-only views)
     */
    setLayout: (layout: DashboardLayout) => {
      update((s) => ({ ...s, currentLayout: layout }))
    },

    /**
     * Clear current dashboard
     */
    clearCurrent: () => {
      update((s) => ({
        ...s,
        current: null,
        currentLayout: null,
        editMode: false,
      }))
    },

    /**
     * Clear error
     */
    clearError: () => {
      update((s) => ({ ...s, error: null }))
    },
  }
}

// Helper to find the next available Y position
function findNextY(widgets: WidgetInstance[]): number {
  if (widgets.length === 0) return 0
  let maxY = 0
  for (const widget of widgets) {
    const bottom = widget.position.y + widget.position.h
    if (bottom > maxY) maxY = bottom
  }
  return maxY
}

export const dashboardStore = createDashboardStore()

// Derived stores for easy access
export const dashboards = derived(dashboardStore, ($store) => $store.items)
export const currentDashboard = derived(dashboardStore, ($store) => $store.current)
export const currentLayout = derived(dashboardStore, ($store) => $store.currentLayout)
export const dashboardLoading = derived(dashboardStore, ($store) => $store.loading)
export const dashboardError = derived(dashboardStore, ($store) => $store.error)
export const dashboardEditMode = derived(dashboardStore, ($store) => $store.editMode)
