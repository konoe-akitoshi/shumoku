/**
 * Widget Type Definitions
 */

import type { Component } from 'svelte'

export interface WidgetPosition {
  x: number
  y: number
  w: number
  h: number
}

export interface WidgetInstance {
  id: string
  type: string
  config: Record<string, unknown>
  position: WidgetPosition
}

export interface WidgetDefinition {
  type: string
  displayName: string
  icon: string
  description: string
  defaultSize: { w: number; h: number }
  minSize?: { w: number; h: number }
  configSchema?: JSONSchemaField[]
  component: Component<WidgetProps>
}

export interface WidgetProps {
  id: string
  config: Record<string, unknown>
  editMode: boolean
  onConfigChange?: (config: Record<string, unknown>) => void
  onRemove?: () => void
}

// JSON Schema-like field definition for config UI generation
export interface JSONSchemaField {
  name: string
  label: string
  type: 'string' | 'number' | 'boolean' | 'select' | 'topology-select' | 'datasource-select'
  default?: unknown
  required?: boolean
  options?: Array<{ label: string; value: string }>
  description?: string
}

// Widget config types
export interface TopologyWidgetConfig {
  topologyId: string
  sheetId: string
  showMetrics: boolean
  showLabels: boolean
  interactive: boolean
}

export interface MetricsGaugeWidgetConfig {
  title: string
  dataSourceId: string
  metricType: 'nodes-up' | 'nodes-down' | 'links-healthy' | 'custom'
}

export interface HealthStatusWidgetConfig {
  title: string
  showDetails: boolean
}

export interface DataSourceStatusWidgetConfig {
  title: string
  showLastChecked: boolean
}
