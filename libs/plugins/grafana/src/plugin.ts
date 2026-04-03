/**
 * Grafana Data Source Plugin
 *
 * Provides alerts capability via Grafana webhook or Alertmanager API.
 * Alert storage is injected via setAlertStore() for server environments.
 */

import {
  type Alert,
  type AlertQueryOptions,
  type AlertSeverity,
  type AlertsCapable,
  addHttpWarning,
  type ConnectionResult,
  type DataSourceCapability,
  type DataSourcePlugin,
} from '@shumoku/core'
import type { AlertStoreService, GrafanaPluginConfig } from './types.js'

// ============================================
// Helper Functions
// ============================================

const SEVERITY_MAP: Record<string, AlertSeverity> = {
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

export const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  ok: 0,
  information: 1,
  warning: 2,
  average: 3,
  high: 4,
  disaster: 5,
}

export function mapSeverity(severity?: string): AlertSeverity {
  if (!severity) return 'information'
  return SEVERITY_MAP[severity.toLowerCase()] || 'information'
}

export function buildTitle(labels: Record<string, string>): string {
  const name = labels['alertname'] || 'Unknown Alert'
  const host = labels['hostname'] || labels['instance'] || labels['host']
  return host ? `${name} - ${host}` : name
}

export function filterLabels(labels: Record<string, string>): Record<string, string> {
  const filtered: Record<string, string> = {}
  for (const [key, value] of Object.entries(labels)) {
    if (key.startsWith('__')) continue
    filtered[key] = value
  }
  return filtered
}

// ============================================
// Plugin Class
// ============================================

export class GrafanaPlugin implements DataSourcePlugin, AlertsCapable {
  readonly type = 'grafana'
  readonly displayName = 'Grafana'
  readonly capabilities: readonly DataSourceCapability[] = ['alerts']

  private config: GrafanaPluginConfig | null = null
  private dataSourceId: string | null = null
  private alertStore: AlertStoreService | null = null

  initialize(config: unknown): void {
    this.config = config as GrafanaPluginConfig
  }

  /**
   * Set the data source ID (needed for DB-based alert queries)
   */
  setDataSourceId(id: string): void {
    this.dataSourceId = id
  }

  /**
   * Set the alert store service (DI for server environments)
   */
  setAlertStore(store: AlertStoreService): void {
    this.alertStore = store
  }

  dispose(): void {
    this.config = null
    this.dataSourceId = null
    this.alertStore = null
  }

  async testConnection(): Promise<ConnectionResult> {
    if (!this.config) {
      return { success: false, message: 'Plugin not initialized' }
    }

    try {
      const response = await this.fetch('/api/health')
      if (!response.ok) {
        return {
          success: false,
          message: `Grafana health check failed: ${response.status}`,
        }
      }

      const data = (await response.json()) as { version?: string; database?: string }
      return addHttpWarning(this.config.url, {
        success: true,
        message: `Connected to Grafana${data.version ? ` ${data.version}` : ''}`,
        version: data.version,
      })
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Connection failed',
      }
    }
  }

  // ============================================
  // AlertsCapable Implementation
  // ============================================

  async getAlerts(options?: AlertQueryOptions): Promise<Alert[]> {
    if (this.config?.useWebhook && this.dataSourceId && this.alertStore) {
      // Webhook mode: read from injected alert store
      return this.alertStore.getAlerts(this.dataSourceId, options)
    }

    // Default: poll Alertmanager API directly
    return this.fetchAlertsFromApi(options)
  }

  // ============================================
  // Alertmanager API Fallback
  // ============================================

  private async fetchAlertsFromApi(options?: AlertQueryOptions): Promise<Alert[]> {
    if (!this.config) {
      throw new Error('Plugin not initialized')
    }

    try {
      const response = await this.fetch('/api/alertmanager/grafana/api/v2/alerts')
      if (!response.ok) {
        console.error('[GrafanaPlugin] Alertmanager API error:', response.status)
        return []
      }

      interface GrafanaAlertmanagerAlert {
        fingerprint: string
        labels: Record<string, string>
        annotations?: Record<string, string>
        startsAt: string
        endsAt?: string
        status: { state: 'active' | 'suppressed' | 'unprocessed' }
        generatorURL?: string
      }

      const alertmanagerAlerts = (await response.json()) as GrafanaAlertmanagerAlert[]

      const now = Date.now()
      const timeRangeMs = (options?.timeRange || 3600) * 1000

      const alerts: Alert[] = alertmanagerAlerts
        .filter((a) => {
          const isActive = a.status.state === 'active'
          if (!isActive) {
            if (options?.activeOnly) return false
            const startTime = new Date(a.startsAt).getTime()
            if (now - startTime > timeRangeMs) return false
          }
          return true
        })
        .map(
          (a) =>
            ({
              id: a.fingerprint,
              severity: mapSeverity(a.labels['severity']),
              title: buildTitle(a.labels),
              description: a.annotations?.['description'] || a.annotations?.['summary'],
              host: a.labels['hostname'] || a.labels['instance'] || a.labels['host'],
              startTime: new Date(a.startsAt).getTime(),
              endTime: a.endsAt ? new Date(a.endsAt).getTime() : undefined,
              status: a.status.state === 'active' ? 'active' : 'resolved',
              source: 'grafana' as const,
              url: a.generatorURL,
              labels: filterLabels(a.labels),
            }) satisfies Alert,
        )

      if (options?.minSeverity) {
        const minOrder = SEVERITY_ORDER[options.minSeverity]
        return alerts.filter((a) => SEVERITY_ORDER[a.severity] >= minOrder)
      }

      return alerts
    } catch (err) {
      console.error('[GrafanaPlugin] Failed to fetch alerts:', err)
      return []
    }
  }

  // ============================================
  // Internal Methods
  // ============================================

  private async fetch(path: string): Promise<Response> {
    if (!this.config) {
      throw new Error('Plugin not initialized')
    }

    const url = this.config.url.replace(/\/$/, '') + path
    return fetch(url, {
      headers: {
        Authorization: `Bearer ${this.config.token}`,
      },
      signal: AbortSignal.timeout(5000),
    })
  }
}
