/**
 * Widget Events Store
 * Enables inter-widget communication for coordinated actions
 */

import { writable, get } from 'svelte/store'

/**
 * Event types for widget communication
 */
export type WidgetEventType = 'zoom-to-node' | 'highlight-node' | 'select-node' | 'clear-highlight'

/**
 * Widget event payload
 */
export interface WidgetEvent {
  type: WidgetEventType
  payload: {
    /** Target topology ID */
    topologyId: string
    /** Target node ID */
    nodeId: string
    /** Duration in ms for temporary effects like highlight */
    duration?: number
    /** Source widget ID that triggered the event */
    sourceWidgetId?: string
  }
}

/**
 * Event listener callback
 */
type WidgetEventListener = (event: WidgetEvent) => void

/**
 * Internal state for event bus
 */
interface WidgetEventBusState {
  lastEvent: WidgetEvent | null
  listeners: Set<WidgetEventListener>
}

function createWidgetEventBus() {
  const { subscribe, set, update } = writable<WidgetEvent | null>(null)

  // Store listeners separately for cleanup
  const listeners = new Set<WidgetEventListener>()

  return {
    subscribe,

    /**
     * Emit an event to all listeners
     */
    emit: (event: WidgetEvent) => {
      // Update store (triggers reactive updates in Svelte)
      set(event)

      // Notify all listeners
      for (const listener of listeners) {
        try {
          listener(event)
        } catch (err) {
          console.error('[WidgetEvents] Error in listener:', err)
        }
      }

      // Auto-clear after a short delay to prevent stale events
      setTimeout(() => set(null), 100)
    },

    /**
     * Subscribe to events with a callback
     * Returns an unsubscribe function
     */
    on: (listener: WidgetEventListener): (() => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    /**
     * Clear all listeners (for cleanup)
     */
    clear: () => {
      listeners.clear()
      set(null)
    },

    /**
     * Get the current event (if any)
     */
    get: () => get({ subscribe }),
  }
}

/**
 * Global widget event bus
 */
export const widgetEvents = createWidgetEventBus()

/**
 * Helper to emit a zoom-to-node event
 */
export function emitZoomToNode(topologyId: string, nodeId: string, sourceWidgetId?: string): void {
  widgetEvents.emit({
    type: 'zoom-to-node',
    payload: { topologyId, nodeId, sourceWidgetId },
  })
}

/**
 * Helper to emit a highlight-node event
 */
export function emitHighlightNode(
  topologyId: string,
  nodeId: string,
  duration = 3000,
  sourceWidgetId?: string,
): void {
  widgetEvents.emit({
    type: 'highlight-node',
    payload: { topologyId, nodeId, duration, sourceWidgetId },
  })
}

/**
 * Helper to emit a select-node event
 */
export function emitSelectNode(topologyId: string, nodeId: string, sourceWidgetId?: string): void {
  widgetEvents.emit({
    type: 'select-node',
    payload: { topologyId, nodeId, sourceWidgetId },
  })
}
