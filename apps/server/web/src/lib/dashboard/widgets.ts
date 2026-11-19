/**
 * The widgets a dashboard can hold. Each one's settings are its `configSchema`, rendered by the
 * generic `SchemaForm`: a widget has no settings UI of its own.
 */

import {
  ChartLineIcon,
  CpuIcon,
  DatabaseIcon,
  HeartIcon,
  TreeStructureIcon,
  WarningIcon,
} from 'phosphor-svelte'
import type { WidgetDefinition } from './widget-types'
import AlertsWidget from './widgets/AlertsWidget.svelte'
import DataSourceWidget from './widgets/DataSourceWidget.svelte'
import DeviceStatusWidget from './widgets/DeviceStatusWidget.svelte'
import HealthWidget from './widgets/HealthWidget.svelte'
import MetricsWidget from './widgets/MetricsWidget.svelte'
import TopologyWidget from './widgets/TopologyWidget.svelte'

const TOPOLOGY = {
  type: 'string',
  title: 'Topology',
  optionsSource: 'topologies',
  placeholder: 'Select a topology…',
} as const

const TITLE = (placeholder: string) =>
  ({ type: 'string', title: 'Title', placeholder, help: 'Empty: the default title.' }) as const

export const WIDGETS: readonly WidgetDefinition[] = [
  {
    type: 'topology',
    displayName: 'Topology',
    description: 'A network topology, with live traffic and alert highlights',
    icon: TreeStructureIcon,
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 3, h: 2 },
    configSchema: {
      type: 'object',
      required: ['topologyId'],
      properties: {
        topologyId: TOPOLOGY,
        title: { ...TITLE('The topology’s name') },
        followAlerts: {
          type: 'boolean',
          title: 'Follow new alerts',
          default: false,
          help: 'Fly to a new alert’s nodes, hold there, then go back to the whole topology. For a wall display; never while someone is using it.',
        },
        followMinSeverity: {
          type: 'string',
          title: 'Follow alerts from',
          default: 'high',
          oneOf: [
            { const: 'critical', title: 'Critical' },
            { const: 'high', title: 'High and above' },
            { const: 'medium', title: 'Medium and above' },
            { const: 'low', title: 'Low and above' },
          ],
        },
        returnAfterIdle: {
          type: 'number',
          title: 'Back to the whole topology after (seconds idle)',
          default: 120,
          minimum: 0,
          help: 'After someone moved the view and left it. 0: stay where it was left.',
        },
      },
    },
    shareable: true,
    bleed: true,
    component: TopologyWidget,
  },
  {
    type: 'alerts',
    displayName: 'Alerts',
    description: 'Alerts from a monitoring system, highlighted on the topologies',
    icon: WarningIcon,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 2, h: 2 },
    configSchema: {
      type: 'object',
      required: ['dataSourceId'],
      properties: {
        dataSourceId: {
          type: 'string',
          title: 'Data source',
          optionsSource: 'alert-sources',
          placeholder: 'Select a data source…',
          help: 'An alert-capable data source (Zabbix, Prometheus, Grafana, …).',
        },
        title: { ...TITLE('Alerts') },
        maxItems: { type: 'number', title: 'Max items', default: 10, minimum: 1 },
        autoRefresh: {
          type: 'number',
          title: 'Refresh every (seconds)',
          default: 30,
          minimum: 0,
          help: '0: only when Refresh is pressed.',
        },
        showResolved: { type: 'boolean', title: 'Show resolved alerts', default: false },
        staleAfterHours: {
          type: 'number',
          title: 'Set aside as stale after (hours)',
          default: 24,
          minimum: 0,
          help: 'An alert still open but not raised again for this long goes to the Stale list, grey on the topologies. 0: never.',
        },
      },
    },
    shareable: true,
    component: AlertsWidget,
  },
  {
    type: 'device-status',
    displayName: 'Device Status',
    description: 'Devices up / down by type, as a score',
    icon: CpuIcon,
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 2, h: 2 },
    configSchema: {
      type: 'object',
      required: ['topologyId'],
      properties: {
        topologyId: TOPOLOGY,
        title: { ...TITLE('Device Status') },
        showDetail: {
          type: 'boolean',
          title: 'Always show the breakdown by type',
          default: false,
        },
      },
    },
    shareable: true,
    component: DeviceStatusWidget,
  },
  {
    type: 'metrics-gauge',
    displayName: 'Metrics Gauge',
    description: 'One figure from a topology’s live metrics',
    icon: ChartLineIcon,
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
    configSchema: {
      type: 'object',
      required: ['topologyId'],
      properties: {
        topologyId: TOPOLOGY,
        title: { ...TITLE('Metrics Gauge') },
        metricType: {
          type: 'string',
          title: 'Metric',
          default: 'nodes-up',
          oneOf: [
            { const: 'nodes-up', title: 'Nodes up' },
            { const: 'nodes-down', title: 'Nodes down' },
            { const: 'links-healthy', title: 'Healthy links' },
            { const: 'utilization', title: 'Average utilization' },
          ],
        },
      },
    },
    shareable: true,
    component: MetricsWidget,
  },
  {
    type: 'health-status',
    displayName: 'Health Status',
    description: 'The Server’s API and data sources at a glance',
    icon: HeartIcon,
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
    configSchema: {
      type: 'object',
      properties: {
        title: { ...TITLE('Health Status') },
        showDetails: { type: 'boolean', title: 'Show details', default: true },
      },
    },
    // Counts the whole server's inventory: not for anonymous viewers.
    shareable: false,
    component: HealthWidget,
  },
  {
    type: 'datasource-status',
    displayName: 'Data Sources',
    description: 'Every data source and whether it is connected',
    icon: DatabaseIcon,
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 3, h: 2 },
    configSchema: {
      type: 'object',
      properties: {
        title: { ...TITLE('Data Sources') },
        showLastChecked: { type: 'boolean', title: 'Show when last checked', default: true },
      },
    },
    // The server-wide list of data sources: not for anonymous viewers.
    shareable: false,
    component: DataSourceWidget,
  },
]

const BY_TYPE = new Map(WIDGETS.map((w) => [w.type, w]))

export function widgetDefinition(type: string): WidgetDefinition | undefined {
  return BY_TYPE.get(type)
}
