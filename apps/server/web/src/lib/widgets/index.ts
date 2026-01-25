/**
 * Widgets Module
 * Exports all widget components and registry
 */

export * from './types'
export * from './registry'

// Import widget components
import TopologyWidget from './TopologyWidget.svelte'
import MetricsWidget from './MetricsWidget.svelte'
import HealthWidget from './HealthWidget.svelte'
import DataSourceWidget from './DataSourceWidget.svelte'
import DeviceStatusWidget from './DeviceStatusWidget.svelte'

// Import registry
import { registerWidget } from './registry'
import type { WidgetDefinition } from './types'

// Define built-in widgets
const builtinWidgets: WidgetDefinition[] = [
  {
    type: 'topology',
    displayName: 'Topology',
    icon: 'TreeStructure',
    description: 'Display a network topology diagram',
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 3, h: 2 },
    configSchema: [
      {
        name: 'topologyId',
        label: 'Topology',
        type: 'topology-select',
        required: true,
      },
      {
        name: 'sheetId',
        label: 'Sheet',
        type: 'string',
        default: 'root',
      },
      {
        name: 'showMetrics',
        label: 'Show Metrics',
        type: 'boolean',
        default: true,
      },
      {
        name: 'interactive',
        label: 'Interactive',
        type: 'boolean',
        default: true,
        description: 'Enable pan and zoom',
      },
    ],
    component: TopologyWidget,
  },
  {
    type: 'metrics-gauge',
    displayName: 'Metrics Gauge',
    icon: 'ChartLine',
    description: 'Display a metric value with gauge',
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
    configSchema: [
      {
        name: 'title',
        label: 'Title',
        type: 'string',
        default: 'Metrics',
      },
      {
        name: 'metricType',
        label: 'Metric Type',
        type: 'select',
        default: 'nodes-up',
        options: [
          { label: 'Nodes Up', value: 'nodes-up' },
          { label: 'Nodes Down', value: 'nodes-down' },
          { label: 'Healthy Links', value: 'links-healthy' },
          { label: 'Avg Utilization', value: 'utilization' },
        ],
      },
    ],
    component: MetricsWidget,
  },
  {
    type: 'health-status',
    displayName: 'Health Status',
    icon: 'Heart',
    description: 'Display system health overview',
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
    configSchema: [
      {
        name: 'title',
        label: 'Title',
        type: 'string',
        default: 'System Health',
      },
      {
        name: 'showDetails',
        label: 'Show Details',
        type: 'boolean',
        default: true,
      },
    ],
    component: HealthWidget,
  },
  {
    type: 'datasource-status',
    displayName: 'Data Sources',
    icon: 'Database',
    description: 'Display data source connection status',
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 3, h: 2 },
    configSchema: [
      {
        name: 'title',
        label: 'Title',
        type: 'string',
        default: 'Data Sources',
      },
      {
        name: 'showLastChecked',
        label: 'Show Last Checked',
        type: 'boolean',
        default: true,
      },
    ],
    component: DataSourceWidget,
  },
  {
    type: 'device-status',
    displayName: 'Device Status',
    icon: 'Cpu',
    description: 'Lighthouse-style status by device type',
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 2, h: 2 },
    configSchema: [
      {
        name: 'topologyId',
        label: 'Topology',
        type: 'topology-select',
        required: true,
      },
      {
        name: 'title',
        label: 'Title',
        type: 'string',
        default: 'Device Status',
      },
    ],
    component: DeviceStatusWidget,
  },
]

// Register all built-in widgets
export function initializeWidgets(): void {
  for (const widget of builtinWidgets) {
    registerWidget(widget)
  }
}

// Export widget components
export {
  TopologyWidget,
  MetricsWidget,
  HealthWidget,
  DataSourceWidget,
  DeviceStatusWidget,
}
