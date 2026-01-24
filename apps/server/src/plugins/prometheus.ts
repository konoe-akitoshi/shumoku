/**
 * Prometheus Data Source Plugin
 *
 * Provides metrics and hosts capabilities via Prometheus HTTP API.
 * Supports SNMP exporter and node_exporter metric formats.
 */

import type { MetricsData, ZabbixMapping } from '../types.js'
import type {
  ConnectionResult,
  DataSourceCapability,
  DataSourcePlugin,
  DiscoveredMetric,
  Host,
  HostItem,
  HostsCapable,
  MetricsCapable,
  PrometheusCustomMetrics,
  PrometheusPluginConfig,
} from './types.js'

/**
 * Metric presets for common exporters
 */
const METRIC_PRESETS: Record<string, PrometheusCustomMetrics> = {
  snmp: {
    inOctets: 'ifHCInOctets',
    outOctets: 'ifHCOutOctets',
    interfaceLabel: 'ifName',
    upMetric: 'up',
  },
  node_exporter: {
    inOctets: 'node_network_receive_bytes_total',
    outOctets: 'node_network_transmit_bytes_total',
    interfaceLabel: 'device',
    upMetric: 'up',
  },
}

/**
 * Prometheus API response types
 */
interface PrometheusResponse<T> {
  status: 'success' | 'error'
  data?: T
  errorType?: string
  error?: string
}

interface PrometheusVectorResult {
  resultType: 'vector'
  result: Array<{
    metric: Record<string, string>
    value: [number, string] // [timestamp, value]
  }>
}

interface PrometheusBuildInfo {
  version: string
  revision: string
  branch: string
  buildUser: string
  buildDate: string
  goVersion: string
}

export class PrometheusPlugin implements DataSourcePlugin, MetricsCapable, HostsCapable {
  readonly type = 'prometheus'
  readonly displayName = 'Prometheus'
  readonly capabilities: readonly DataSourceCapability[] = ['metrics', 'hosts']

  private config: PrometheusPluginConfig | null = null
  private metrics: PrometheusCustomMetrics | null = null

  initialize(config: unknown): void {
    this.config = config as PrometheusPluginConfig

    // Resolve metric names from preset or custom config
    if (this.config.preset === 'custom' && this.config.customMetrics) {
      this.metrics = this.config.customMetrics
    } else {
      this.metrics = METRIC_PRESETS[this.config.preset] || METRIC_PRESETS.snmp
    }
  }

  dispose(): void {
    this.config = null
    this.metrics = null
  }

  // ============================================
  // Base Plugin Methods
  // ============================================

  async testConnection(): Promise<ConnectionResult> {
    try {
      // First check health endpoint
      const healthResponse = await this.fetch('/-/healthy')
      if (!healthResponse.ok) {
        return {
          success: false,
          message: `Prometheus health check failed: ${healthResponse.status}`,
        }
      }

      // Try to get build info for version
      try {
        const buildInfo = await this.query<PrometheusBuildInfo>('/api/v1/status/buildinfo')
        return {
          success: true,
          message: `Connected to Prometheus ${buildInfo.version}`,
          version: buildInfo.version,
        }
      } catch {
        // Build info might not be available, but health check passed
        return {
          success: true,
          message: 'Connected to Prometheus',
        }
      }
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Connection failed',
      }
    }
  }

  // ============================================
  // MetricsCapable Implementation
  // ============================================

  async pollMetrics(mapping: ZabbixMapping): Promise<MetricsData> {
    const metrics: MetricsData = {
      nodes: {},
      links: {},
      timestamp: Date.now(),
    }

    if (!this.metrics) {
      return metrics
    }

    // Poll node metrics (up/down status)
    for (const [nodeId, nodeMapping] of Object.entries(mapping.nodes || {})) {
      // Use instance from mapping, supporting both Zabbix format (hostId) and Prometheus format
      const instance = (nodeMapping as { instance?: string }).instance || nodeMapping.hostId

      if (instance) {
        try {
          const isUp = await this.checkHostUp(instance)
          metrics.nodes[nodeId] = {
            status: isUp ? 'up' : 'down',
            lastSeen: isUp ? Date.now() : undefined,
          }
        } catch {
          metrics.nodes[nodeId] = { status: 'unknown' }
        }
      } else {
        metrics.nodes[nodeId] = { status: 'unknown' }
      }
    }

    // Poll link metrics (interface traffic)
    for (const [linkId, linkMapping] of Object.entries(mapping.links || {})) {
      // Get instance either directly or via monitoredNodeId -> node mapping
      let instance = (linkMapping as { instance?: string }).instance
      const monitoredNodeId = (linkMapping as { monitoredNodeId?: string }).monitoredNodeId
      if (!instance && monitoredNodeId && mapping.nodes?.[monitoredNodeId]) {
        // Resolve instance from node mapping (hostId is the Prometheus instance)
        instance = mapping.nodes[monitoredNodeId].hostId
      }

      const interfaceName =
        (linkMapping as { interface?: string }).interface || linkMapping.interface

      if (instance && interfaceName) {
        try {
          const traffic = await this.getInterfaceTraffic(instance, interfaceName)
          const capacity = linkMapping.capacity || 1_000_000_000 // Default 1Gbps

          // Calculate utilization (traffic is in bytes/sec, convert to bits)
          const inBps = traffic.inBytesPerSec * 8
          const outBps = traffic.outBytesPerSec * 8
          const inUtil = (inBps / capacity) * 100
          const outUtil = (outBps / capacity) * 100
          const maxUtil = Math.max(inUtil, outUtil)

          metrics.links[linkId] = {
            status: 'up',
            utilization: Math.round(maxUtil * 10) / 10,
            inUtilization: Math.round(inUtil * 10) / 10,
            outUtilization: Math.round(outUtil * 10) / 10,
            inBps,
            outBps,
          }
        } catch {
          metrics.links[linkId] = { status: 'unknown' }
        }
      } else {
        metrics.links[linkId] = { status: 'unknown' }
      }
    }

    return metrics
  }

  // ============================================
  // HostsCapable Implementation
  // ============================================

  async getHosts(): Promise<Host[]> {
    if (!this.config) {
      throw new Error('Plugin not initialized')
    }

    const hostLabel = this.config.hostLabel || 'instance'

    try {
      // Get all unique values for the host label
      let url = `/api/v1/label/${hostLabel}/values`

      // If job filter is specified, add a match parameter
      if (this.config.jobFilter) {
        url += `?match[]={job="${this.config.jobFilter}"}`
      }

      const response = await this.apiRequest<string[]>(url)

      // Convert label values to Host objects
      const hosts: Host[] = response.map((value) => ({
        id: value,
        name: value,
        displayName: this.formatHostDisplayName(value),
        status: 'unknown' as const,
      }))

      // Optionally check status for each host (can be slow for many hosts)
      // For now, return with unknown status - UI can check on demand

      return hosts
    } catch (err) {
      console.error('[PrometheusPlugin] Failed to get hosts:', err)
      return []
    }
  }

  async getHostItems(hostId: string): Promise<HostItem[]> {
    if (!this.config || !this.metrics) {
      throw new Error('Plugin not initialized')
    }

    const hostLabel = this.config.hostLabel || 'instance'
    const interfaceLabel = this.metrics.interfaceLabel

    try {
      // Query for interface metrics to list available interfaces
      const query = `${this.metrics.inOctets}{${hostLabel}="${hostId}"}`
      const result = await this.instantQuery(query)

      const items: HostItem[] = []

      for (const series of result.result) {
        const interfaceName = series.metric[interfaceLabel]
        if (interfaceName) {
          // Add in/out items for this interface
          items.push({
            id: `${hostId}:${interfaceName}:in`,
            hostId,
            name: `${interfaceName} - Inbound`,
            key: `${this.metrics.inOctets}{${interfaceLabel}="${interfaceName}"}`,
            lastValue: series.value[1],
            unit: 'bytes/s',
          })
          items.push({
            id: `${hostId}:${interfaceName}:out`,
            hostId,
            name: `${interfaceName} - Outbound`,
            key: `${this.metrics.outOctets}{${interfaceLabel}="${interfaceName}"}`,
            unit: 'bytes/s',
          })
        }
      }

      return items
    } catch (err) {
      console.error('[PrometheusPlugin] Failed to get host items:', err)
      return []
    }
  }

  async searchHosts(query: string): Promise<Host[]> {
    const allHosts = await this.getHosts()
    const lowerQuery = query.toLowerCase()

    return allHosts.filter(
      (host) =>
        host.name.toLowerCase().includes(lowerQuery) ||
        host.displayName?.toLowerCase().includes(lowerQuery),
    )
  }

  async discoverMetrics(hostId: string): Promise<DiscoveredMetric[]> {
    if (!this.config) {
      throw new Error('Plugin not initialized')
    }

    const hostLabel = this.config.hostLabel || 'instance'
    const metrics: DiscoveredMetric[] = []

    try {
      // Get all series for this host
      let selector = `{${hostLabel}="${hostId}"}`
      if (this.config.jobFilter) {
        selector = `{${hostLabel}="${hostId}",job="${this.config.jobFilter}"}`
      }

      const seriesUrl = `/api/v1/series?match[]=${encodeURIComponent(selector)}`
      const seriesData = await this.apiRequest<Array<Record<string, string>>>(seriesUrl)

      // Get unique metric names
      const metricNames = new Set<string>()
      for (const series of seriesData) {
        if (series.__name__) {
          metricNames.add(series.__name__)
        }
      }

      // Fetch metadata for all metrics (HELP, TYPE)
      const metadataMap: Record<string, { type: string; help: string }> = {}
      try {
        const metadataUrl = '/api/v1/metadata'
        const metadataResponse =
          await this.apiRequest<Record<string, Array<{ type: string; help: string }>>>(metadataUrl)
        for (const [name, entries] of Object.entries(metadataResponse)) {
          if (entries.length > 0) {
            metadataMap[name] = entries[0]
          }
        }
      } catch {
        // Metadata endpoint might not be available
      }

      // Query current values for each metric
      for (const metricName of metricNames) {
        try {
          let query = `${metricName}{${hostLabel}="${hostId}"}`
          if (this.config.jobFilter) {
            query = `${metricName}{${hostLabel}="${hostId}",job="${this.config.jobFilter}"}`
          }

          const result = await this.instantQuery(query)

          for (const series of result.result) {
            const labels = { ...series.metric }
            delete labels.__name__

            metrics.push({
              name: metricName,
              labels,
              value: parseFloat(series.value[1]) || 0,
              help: metadataMap[metricName]?.help,
              type: metadataMap[metricName]?.type,
            })
          }
        } catch {
          // Skip metrics that fail to query
        }
      }

      // Sort by metric name
      metrics.sort((a, b) => a.name.localeCompare(b.name))

      return metrics
    } catch (err) {
      console.error('[PrometheusPlugin] Failed to discover metrics:', err)
      return []
    }
  }

  // ============================================
  // Internal Methods
  // ============================================

  /**
   * Make an HTTP request to Prometheus
   */
  private async fetch(path: string, options: RequestInit = {}): Promise<Response> {
    if (!this.config) {
      throw new Error('Plugin not initialized')
    }

    const url = this.config.url.replace(/\/$/, '') + path
    const headers: Record<string, string> = {
      ...((options.headers as Record<string, string>) || {}),
    }

    // Add basic auth if configured
    if (this.config.basicAuth) {
      const credentials = btoa(
        `${this.config.basicAuth.username}:${this.config.basicAuth.password}`,
      )
      headers.Authorization = `Basic ${credentials}`
    }

    return fetch(url, {
      ...options,
      headers,
    })
  }

  /**
   * Query the Prometheus API and return data
   */
  private async query<T>(path: string): Promise<T> {
    const response = await this.fetch(path)

    if (!response.ok) {
      throw new Error(`Prometheus API request failed: ${response.status} ${response.statusText}`)
    }

    const json = (await response.json()) as PrometheusResponse<T>

    if (json.status === 'error') {
      throw new Error(`Prometheus API error: ${json.errorType} - ${json.error}`)
    }

    return json.data as T
  }

  /**
   * Make a generic API request that returns data directly
   */
  private async apiRequest<T>(path: string): Promise<T> {
    const response = await this.fetch(path)

    if (!response.ok) {
      throw new Error(`Prometheus API request failed: ${response.status}`)
    }

    const json = (await response.json()) as PrometheusResponse<T>

    if (json.status === 'error') {
      throw new Error(`Prometheus error: ${json.error}`)
    }

    // For label values endpoint, data is the array directly
    // For other endpoints, it might be nested
    return json.data as T
  }

  /**
   * Execute an instant query
   */
  private async instantQuery(query: string): Promise<PrometheusVectorResult> {
    const encodedQuery = encodeURIComponent(query)
    return this.query<PrometheusVectorResult>(`/api/v1/query?query=${encodedQuery}`)
  }

  /**
   * Check if a host is up using the 'up' metric
   */
  private async checkHostUp(instance: string): Promise<boolean> {
    if (!this.config || !this.metrics) {
      return false
    }

    const hostLabel = this.config.hostLabel || 'instance'
    const upMetric = this.metrics.upMetric || 'up'

    let query = `${upMetric}{${hostLabel}="${instance}"}`
    if (this.config.jobFilter) {
      query = `${upMetric}{${hostLabel}="${instance}",job="${this.config.jobFilter}"}`
    }

    try {
      const result = await this.instantQuery(query)
      // Check if any result has value "1"
      return result.result.some((r) => r.value[1] === '1')
    } catch {
      return false
    }
  }

  /**
   * Get interface traffic metrics
   * Returns bytes per second (using rate over 5 minutes)
   */
  private async getInterfaceTraffic(
    instance: string,
    interfaceName: string,
  ): Promise<{ inBytesPerSec: number; outBytesPerSec: number }> {
    if (!this.config || !this.metrics) {
      return { inBytesPerSec: 0, outBytesPerSec: 0 }
    }

    const hostLabel = this.config.hostLabel || 'instance'
    const interfaceLabel = this.metrics.interfaceLabel

    // Build label selector
    let labelSelector = `${hostLabel}="${instance}",${interfaceLabel}="${interfaceName}"`
    if (this.config.jobFilter) {
      labelSelector += `,job="${this.config.jobFilter}"`
    }

    // Use rate() to convert counter to bytes/sec
    const inQuery = `rate(${this.metrics.inOctets}{${labelSelector}}[5m])`
    const outQuery = `rate(${this.metrics.outOctets}{${labelSelector}}[5m])`

    let inBytesPerSec = 0
    let outBytesPerSec = 0

    try {
      const inResult = await this.instantQuery(inQuery)
      if (inResult.result.length > 0) {
        inBytesPerSec = parseFloat(inResult.result[0].value[1]) || 0
      }
    } catch {
      // Ignore errors for individual metrics
    }

    try {
      const outResult = await this.instantQuery(outQuery)
      if (outResult.result.length > 0) {
        outBytesPerSec = parseFloat(outResult.result[0].value[1]) || 0
      }
    } catch {
      // Ignore errors for individual metrics
    }

    return { inBytesPerSec, outBytesPerSec }
  }

  /**
   * Format instance label to a more readable display name
   * e.g., "192.168.1.1:9116" -> "192.168.1.1"
   */
  private formatHostDisplayName(instance: string): string {
    // Remove port if present
    const colonIndex = instance.lastIndexOf(':')
    if (colonIndex > 0) {
      const possiblePort = instance.substring(colonIndex + 1)
      // Check if it looks like a port number
      if (/^\d+$/.test(possiblePort)) {
        return instance.substring(0, colonIndex)
      }
    }
    return instance
  }
}
