/**
 * Prometheus Data Source Plugin
 *
 * Provides metrics and hosts capabilities via Prometheus HTTP API.
 * Supports SNMP exporter and node_exporter metric formats.
 */

import {
  type Alert,
  type AlertmanagerAlert,
  type AlertQueryOptions,
  type AlertsCapable,
  addHttpWarning,
  type ConnectionResult,
  type DataSourceCapability,
  type DataSourcePlugin,
  type DiscoveredMetric,
  type Host,
  type HostItem,
  type HostsCapable,
  type MetricsCapable,
  type MetricsData,
  type MetricsMapping,
  parseAlertmanagerAlerts,
} from '@shumoku/core'
import type { PrometheusCustomMetrics, PrometheusPluginConfig } from './types.js'

/** Escape a string for use as a double-quoted PromQL label value. */
export function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
}

/**
 * Build a PromQL label selector `{a="x",b="y"}` with every value escaped.
 * Pairs with an undefined/empty value are dropped. This is the injection guard:
 * discovered host / instance / interface values flow into selectors and must
 * not be able to break out of the quoted string.
 */
export function labelSelector(pairs: Record<string, string | undefined>): string {
  const parts = Object.entries(pairs)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([key, v]) => `${key}="${escapeLabelValue(v as string)}"`)
  return `{${parts.join(',')}}`
}

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
      this.metrics = (METRIC_PRESETS[this.config.preset] || METRIC_PRESETS['snmp']) ?? null
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

      // The query API is what hosts/metrics actually depend on — a target can
      // pass the health check while having no query engine at all (e.g. this
      // URL points at a scrape/forward agent like vmagent instead of the
      // queryable Prometheus/VictoriaMetrics server), so treat this as
      // required rather than falling back to a soft "connected".
      try {
        const buildInfo = await this.query<PrometheusBuildInfo>('/api/v1/status/buildinfo')
        return addHttpWarning(this.config.url, {
          success: true,
          message: `Connected to Prometheus ${buildInfo.version}`,
          version: buildInfo.version,
        })
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err)
        return {
          success: false,
          message: `Health check passed, but the query API isn't responding (${detail}). This URL may point at a scrape/forward agent (e.g. vmagent) rather than a queryable Prometheus/VictoriaMetrics endpoint.`,
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
        const query = `up${labelSelector({ job: this.config.jobFilter })}`
        const result = await this.instantQuery(query)
        const total = result.result.length
        const down = result.result.filter((r) => r.value[1] === '0').length
        if (down > 0) {
          warnings.push(`Scrape targets: ${down}/${total} down (job: ${this.config.jobFilter})`)
        }
      } catch {
        warnings.push('Failed to check scrape target health')
      }
    }

    // Poll node metrics (up/down status). Stay silent on host ids
    // Prometheus has no data for — in a multi-source setup another
    // plugin owns the node and a fake `{ status: unknown }` here would
    // clobber its real result during merge.
    for (const [nodeId, nodeMapping] of Object.entries(mapping.nodes || {})) {
      const instance = nodeMapping.hostId
      if (!instance) continue
      try {
        const isUp = await this.checkHostUp(instance)
        if (isUp === undefined) continue // no data for this instance
        metrics.nodes[nodeId] = {
          status: isUp ? 'up' : 'down',
          lastSeen: isUp ? Date.now() : undefined,
        }
      } catch {
        // Transport failure — leave silent (future: emit failing once
        // we can distinguish transport from "instance not in this Prom").
      }
    }

    // Poll link metrics (interface traffic) — same silence rule.
    for (const [linkId, linkMapping] of Object.entries(mapping.links || {})) {
      // Get instance via monitoredNodeId -> node mapping
      let instance: string | undefined
      const monitoredNodeId = linkMapping.monitoredNodeId
      if (monitoredNodeId && mapping.nodes?.[monitoredNodeId]) {
        instance = mapping.nodes[monitoredNodeId].hostId
      }
      const interfaceName = linkMapping.interface
      if (!instance || !interfaceName) continue

      try {
        const traffic = await this.getInterfaceTraffic(instance, interfaceName)
        // No samples for either direction → not a Prometheus link;
        // leave silent so another source can fill the slot.
        if (!traffic.hasData) continue
        const capacity = linkMapping.bandwidth || 1_000_000_000 // Default 1Gbps
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
        // Transport failure — leave silent.
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

      // If job filter is specified, add a match parameter (escaped + encoded)
      if (this.config.jobFilter) {
        url += `?match[]=${encodeURIComponent(labelSelector({ job: this.config.jobFilter }))}`
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
        const ifName = series.metric[interfaceLabel]
        if (ifName) {
          // Add in/out items for this interface
          items.push({
            id: `${hostId}:${ifName}:in`,
            hostId,
            name: `${ifName} - Inbound`,
            key: `${this.metrics.inOctets}{${interfaceLabel}="${ifName}"}`,
            lastValue: series.value[1],
            unit: 'bytes/s',
            interfaceName: ifName,
            direction: 'in',
          })
          items.push({
            id: `${hostId}:${ifName}:out`,
            hostId,
            name: `${ifName} - Outbound`,
            key: `${this.metrics.outOctets}{${interfaceLabel}="${ifName}"}`,
            unit: 'bytes/s',
            interfaceName: ifName,
            direction: 'out',
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
      const selector = labelSelector({ [hostLabel]: hostId, job: this.config.jobFilter })

      const seriesUrl = `/api/v1/series?match[]=${encodeURIComponent(selector)}`
      const seriesData = await this.apiRequest<Array<Record<string, string>>>(seriesUrl)

      // Get unique metric names
      const metricNames = new Set<string>()
      for (const series of seriesData) {
        if (series['__name__']) {
          metricNames.add(series['__name__'])
        }
      }

      // Fetch metadata for all metrics (HELP, TYPE)
      const metadataMap: Record<string, { type: string; help: string }> = {}
      try {
        const metadataUrl = '/api/v1/metadata'
        const metadataResponse =
          await this.apiRequest<Record<string, Array<{ type: string; help: string }>>>(metadataUrl)

        for (const [name, entries] of Object.entries(metadataResponse)) {
          if (entries[0]) {
            metadataMap[name] = entries[0]
          }
        }
      } catch {
        // Metadata endpoint might not be available
      }

      // Query current values for each metric
      for (const metricName of metricNames) {
        try {
          const query = `${metricName}${labelSelector({ [hostLabel]: hostId, job: this.config.jobFilter })}`

          const result = await this.instantQuery(query)

          for (const series of result.result) {
            const labels = { ...series.metric }
            delete labels['__name__']

            // Prometheus exposes a native counter/gauge/histogram/summary
            // type per metric. Park it on a label so the UI's free-form
            // dump can surface it without core having to bless a "type"
            // field on the display contract.
            const promType = metadataMap[metricName]?.type
            if (promType) labels['__type'] = promType

            metrics.push({
              name: metricName,
              labels,
              value: parseFloat(series.value[1]) || 0,
              help: metadataMap[metricName]?.help,
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

      // One shared Alertmanager parser (active/timeRange/minSeverity filters,
      // severity mapping, host-label priority) — see @shumoku/core/plugin-kit.
      const raw = (await response.json()) as AlertmanagerAlert[]
      return parseAlertmanagerAlerts(raw, { source: 'prometheus', query: options })
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
      headers['Authorization'] = `Basic ${credentials}`
    }

    return fetch(url, { headers })
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
      headers['Authorization'] = `Basic ${credentials}`
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
  private async checkHostUp(instance: string): Promise<boolean | undefined> {
    if (!this.config || !this.metrics) {
      return undefined
    }

    const hostLabel = this.config.hostLabel || 'instance'
    const upMetric = this.metrics.upMetric || 'up'

    const buildQuery = (metric: string) =>
      `${metric}${labelSelector({ [hostLabel]: instance, job: this.config?.jobFilter })}`

    // Empty result = "Prometheus has no series matching this instance"
    // which we surface as `undefined` so the caller can stay silent
    // (multi-source merge correctness). `false` is reserved for "we
    // have data and it says the host is down".
    try {
      const result = await this.instantQuery(buildQuery(upMetric))

      if (upMetric === 'snmp_scrape_pdus_returned') {
        // SNMP device: value > 0 means device responded
        if (result.result.length > 0) {
          return result.result.some((r) => Number(r.value[1]) > 0)
        }
        // No SNMP metrics for this host — fall back to standard "up" metric
        const fallback = await this.instantQuery(buildQuery('up'))
        if (fallback.result.length === 0) return undefined
        return fallback.result.some((r) => r.value[1] === '1')
      }

      if (result.result.length === 0) return undefined
      return result.result.some((r) => r.value[1] === '1')
    } catch {
      return undefined
    }
  }

  /**
   * Get interface traffic metrics
   * Returns bytes per second (using rate over 5 minutes)
   */
  private async getInterfaceTraffic(
    instance: string,
    interfaceName: string,
  ): Promise<{ inBytesPerSec: number; outBytesPerSec: number; hasData: boolean }> {
    if (!this.config || !this.metrics) {
      return { inBytesPerSec: 0, outBytesPerSec: 0, hasData: false }
    }

    const hostLabel = this.config.hostLabel || 'instance'
    const interfaceLabel = this.metrics.interfaceLabel

    // Build label selector (values escaped)
    const selector = labelSelector({
      [hostLabel]: instance,
      [interfaceLabel]: interfaceName,
      job: this.config.jobFilter,
    })

    // Use rate() to convert counter to bytes/sec
    const inQuery = `rate(${this.metrics.inOctets}${selector}[5m])`
    const outQuery = `rate(${this.metrics.outOctets}${selector}[5m])`

    let inBytesPerSec = 0
    let outBytesPerSec = 0
    let hasData = false

    try {
      const inResult = await this.instantQuery(inQuery)
      if (inResult.result[0]) {
        inBytesPerSec = parseFloat(inResult.result[0].value[1]) || 0
        hasData = true
      }
    } catch {
      // Ignore errors for individual metrics
    }

    try {
      const outResult = await this.instantQuery(outQuery)
      if (outResult.result[0]) {
        outBytesPerSec = parseFloat(outResult.result[0].value[1]) || 0
        hasData = true
      }
    } catch {
      // Ignore errors for individual metrics
    }

    return { inBytesPerSec, outBytesPerSec, hasData }
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
