/**
 * Widget Registry
 * Manages registration and retrieval of widget definitions
 */

import type { WidgetDefinition } from './types'

// Widget registry
const widgetRegistry = new Map<string, WidgetDefinition>()

/**
 * Register a widget definition
 */
export function registerWidget(definition: WidgetDefinition): void {
  widgetRegistry.set(definition.type, definition)
}

/**
 * Get a widget definition by type
 */
export function getWidget(type: string): WidgetDefinition | undefined {
  return widgetRegistry.get(type)
}

/**
 * Get all registered widget definitions
 */
export function getAllWidgets(): WidgetDefinition[] {
  return Array.from(widgetRegistry.values())
}

/**
 * Check if a widget type is registered
 */
export function hasWidget(type: string): boolean {
  return widgetRegistry.has(type)
}

// Export the registry for direct access if needed
export { widgetRegistry }
