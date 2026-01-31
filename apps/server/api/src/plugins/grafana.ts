/**
 * Grafana Data Source Plugin
 *
 * Provides alerts capability via Grafana webhook (Contact Point).
 * Alerts are stored in SQLite when received via webhook.
 * Falls back to Alertmanager API polling when no webhook alerts exist in DB.
 */

import {
  GrafanaAlertService,
  mapSeverity,
  buildTitle,
  filterLabels,
  SEVERITY_ORDER,
} from '../services/grafana-alerts.js'
import type {
  Alert,
  AlertQueryOptions,
  AlertsCapable,
  ConnectionResult,
  DataSourceCapability,
  DataSourcePlugin,
  GrafanaPluginConfig,
} from './types.js'

export class GrafanaPlugin implements DataSourcePlugin, AlertsCapable {
  readonly type = 'grafana'
  readonly displayName = 'Grafana'
  readonly capabilities: readonly DataSourceCapability[] = ['alerts']

  private config: GrafanaPluginConfig | null = null
  private dataSourceId: string | null = null

  initialize(config: unknown): void {
    this.config = config as GrafanaPluginConfig
  }

  /**
   * Set the data source ID (needed for DB-based alert queries)
   */
  setDataSourceId(id: string): void {
    this.dataSourceId = id
  }

  dispose(): void {
    this.config = null
    this.dataSourceId = null
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      const response = await this.fetch('/api/health')
      if (!response.ok) {
        return {
          success: false,
          message: `Grafana health check failed: ${response.status}`,
        }
      }

      const data = (await response.json()) as { version?: string; database?: string }
      return {
        success: true,
        message: `Connected to Grafana${data.version ? ` ${data.version}` : ''}`,
        version: data.version,
      }
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
    if (this.config?.useWebhook && this.dataSourceId) {
      // Webhook mode: read from DB
      const service = new GrafanaAlertService()
      return service.getAlerts(this.dataSourceId, options)
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
        .map((a) => ({
            id: a.fingerprint,
            severity: mapSeverity(a.labels.severity),
            title: buildTitle(a.labels),
            description: a.annotations?.description || a.annotations?.summary,
            host: a.labels.hostname || a.labels.instance || a.labels.host,
            startTime: new Date(a.startsAt).getTime(),
            endTime: a.endsAt ? new Date(a.endsAt).getTime() : undefined,
            status: a.status.state === 'active' ? 'active' : 'resolved',
            source: 'grafana' as const,
            url: a.generatorURL,
            labels: filterLabels(a.labels),
          }) satisfies Alert)

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
