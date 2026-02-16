/**
 * Prometheus Data Source Plugin
 *
 * Provides metrics and hosts capabilities via Prometheus HTTP API.
 * Supports SNMP exporter and node_exporter metric formats.
 */

import type { MetricsData, MetricsMapping } from '../types.js'
import {
  addHttpWarning,
  type ConnectionResult,
  type DataSourceCapability,
  type DataSourcePlugin,
  type DiscoveredMetric,
  type Host,
  type HostItem,
  type HostsCapable,
  type MetricsCapable,
  type AlertsCapable,
  type PrometheusCustomMetrics,
  type PrometheusPluginConfig,
  type Alert,
  type AlertQueryOptions,
  type AlertSeverity,
} from './types.js'

/**
 * Metric presets for common exporters
 */
const METRIC_PRESETS: Record<string, PrometheusCustomMetrics> = {
  snmp: {
    inOctets: 'ifHCInOctets',
    outOctets: 'ifHCOutOctets',
    interfaceLabel: 'ifName',
    upMetric: 'snmp_scrape_pdus_returned',
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

export class PrometheusPlugin
  implements DataSourcePlugin, MetricsCapable, HostsCapable, AlertsCapable
{
  readonly type = 'prometheus'
  readonly displayName = 'Prometheus'
  readonly capabilities: readonly DataSourceCapability[] = ['metrics', 'hosts', 'alerts']

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
    if (!this.config) {
      return { success: false, message: 'Plugin not initialized' }
    }

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
        return addHttpWarning(this.config.url, {
          success: true,
          message: `Connected to Prometheus ${buildInfo.version}`,
          version: buildInfo.version,
        })
      } catch {
        // Build info might not be available, but health check passed
        return addHttpWarning(this.config.url, {
          success: true,
          message: 'Connected to Prometheus',
        })
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

  async pollMetrics(mapping: MetricsMapping): Promise<MetricsData> {
    const warnings: string[] = []
    const metrics: MetricsData = {
      nodes: {},
      links: {},
      timestamp: Date.now(),
    }

    if (!this.metrics) {
      return metrics
    }

    // Exporter health check (scrape target status)
    // Only run when jobFilter is configured to avoid noisy results from unrelated jobs
    if (this.config?.jobFilter) {
      try {
        const query = `up{job="${this.config.jobFilter}"}`
        const result = await this.instantQuery(query)
        const total = result.result.length
        const down = result.result.filter((r) => r.value[1] === '0').length
        if (down > 0) {
          warnings.push(
            `Scrape targets: ${down}/${total} down (job: ${this.config.jobFilter})`,
          )
        }
      } catch {
        warnings.push('Failed to check scrape target health')
      }
    }

    // Poll node metrics (up/down status)
    for (const [nodeId, nodeMapping] of Object.entries(mapping.nodes || {})) {
      const instance = nodeMapping.hostId

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
      // Get instance via monitoredNodeId -> node mapping
      let instance: string | undefined
      if (linkMapping.monitoredNodeId && mapping.nodes?.[linkMapping.monitoredNodeId]) {
        instance = mapping.nodes[linkMapping.monitoredNodeId].hostId
      }

      const interfaceName = linkMapping.interface

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
            utilization: Math.ceil(maxUtil),
            inUtilization: Math.ceil(inUtil),
            outUtilization: Math.ceil(outUtil),
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

    if (warnings.length > 0) {
      metrics.warnings = warnings
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
  // AlertsCapable Implementation
  // ============================================

  async getAlerts(options?: AlertQueryOptions): Promise<Alert[]> {
    if (!this.config) {
      throw new Error('Plugin not initialized')
    }

    // Alertmanager API
    // Try to use alertmanagerUrl from config, or derive from Prometheus URL
    const alertmanagerUrl = this.getAlertmanagerUrl()

    try {
      const response = await this.fetchAlertmanager(alertmanagerUrl, '/api/v2/alerts')
      if (!response.ok) {
        console.error('[PrometheusPlugin] Alertmanager API error:', response.status)
        return []
      }

      interface AlertmanagerAlert {
        fingerprint: string
        labels: Record<string, string>
        annotations?: Record<string, string>
        startsAt: string
        endsAt?: string
        status: { state: 'active' | 'suppressed' | 'unprocessed' }
        generatorURL?: string
      }

      const alertmanagerAlerts = (await response.json()) as AlertmanagerAlert[]

      const now = Date.now()
      const timeRangeMs = (options?.timeRange || 3600) * 1000

      const alerts: Alert[] = alertmanagerAlerts
        .filter((a) => {
          const isActive = a.status.state === 'active'
          // Active alerts are always included; resolved alerts are filtered by timeRange
          if (!isActive) {
            if (options?.activeOnly) return false
            const startTime = new Date(a.startsAt).getTime()
            if (now - startTime > timeRangeMs) return false
          }
          return true
        })
        .map((a) => {
          const severity = this.mapAlertmanagerSeverity(a.labels.severity)
          return {
            id: a.fingerprint,
            severity,
            title: a.labels.alertname || 'Unknown Alert',
            description: a.annotations?.description || a.annotations?.summary,
            host: a.labels.instance || a.labels.host,
            startTime: new Date(a.startsAt).getTime(),
            endTime: a.endsAt ? new Date(a.endsAt).getTime() : undefined,
            status: a.status.state === 'active' ? 'active' : 'resolved',
            source: 'prometheus' as const,
            url: a.generatorURL,
          } satisfies Alert
        })

      // Filter by minimum severity
      if (options?.minSeverity) {
        const minSeverityOrder = this.getSeverityOrder(options.minSeverity)
        return alerts.filter((a) => this.getSeverityOrder(a.severity) >= minSeverityOrder)
      }

      return alerts
    } catch (err) {
      console.error('[PrometheusPlugin] Failed to fetch alerts:', err)
      return []
    }
  }

  private getAlertmanagerUrl(): string {
    if (!this.config) {
      throw new Error('Plugin not initialized')
    }

    // If alertmanagerUrl is configured, use it
    if (this.config.alertmanagerUrl) {
      return this.config.alertmanagerUrl.replace(/\/$/, '')
    }

    // Otherwise, try to derive from Prometheus URL (common pattern: replace 9090 with 9093)
    const prometheusUrl = this.config.url.replace(/\/$/, '')
    return prometheusUrl.replace(':9090', ':9093')
  }

  private async fetchAlertmanager(baseUrl: string, path: string): Promise<Response> {
    const url = baseUrl + path
    const headers: Record<string, string> = {}

    // Use same auth as Prometheus if configured
    if (this.config?.basicAuth) {
      const credentials = btoa(
        `${this.config.basicAuth.username}:${this.config.basicAuth.password}`,
      )
      headers.Authorization = `Basic ${credentials}`
    }

    return fetch(url, { headers })
  }

  private mapAlertmanagerSeverity(severity?: string): AlertSeverity {
    if (!severity) return 'information'

    const severityLower = severity.toLowerCase()
    const severityMap: Record<string, AlertSeverity> = {
      critical: 'disaster',
      disaster: 'disaster',
      high: 'high',
      major: 'high',
      error: 'high',
      average: 'average',
      medium: 'average',
      warning: 'warning',
      warn: 'warning',
      minor: 'warning',
      low: 'information',
      info: 'information',
      information: 'information',
      none: 'ok',
      ok: 'ok',
    }

    return severityMap[severityLower] || 'information'
  }

  private getSeverityOrder(severity: AlertSeverity): number {
    const order: Record<AlertSeverity, number> = {
      ok: 0,
      information: 1,
      warning: 2,
      average: 3,
      high: 4,
      disaster: 5,
    }
    return order[severity] ?? 1
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
      signal: AbortSignal.timeout(5000),
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
   * Check if a host is up using the configured upMetric.
   * For SNMP preset: tries snmp_scrape_pdus_returned first (value > 0),
   * then falls back to standard "up" metric for non-SNMP devices (e.g. APs).
   * For others: up == 1 means the scrape target is reachable.
   */
  private async checkHostUp(instance: string): Promise<boolean> {
    if (!this.config || !this.metrics) {
      return false
    }

    const hostLabel = this.config.hostLabel || 'instance'
    const upMetric = this.metrics.upMetric || 'up'

    const buildQuery = (metric: string) => {
      if (this.config!.jobFilter) {
        return `${metric}{${hostLabel}="${instance}",job="${this.config!.jobFilter}"}`
      }
      return `${metric}{${hostLabel}="${instance}"}`
    }

    try {
      const result = await this.instantQuery(buildQuery(upMetric))

      if (upMetric === 'snmp_scrape_pdus_returned') {
        // SNMP device: value > 0 means device responded
        if (result.result.length > 0) {
          return result.result.some((r) => Number(r.value[1]) > 0)
        }
        // No SNMP metrics for this host — fall back to standard "up" metric
        const fallback = await this.instantQuery(buildQuery('up'))
        return fallback.result.some((r) => r.value[1] === '1')
      }

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
