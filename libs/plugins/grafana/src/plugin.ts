/**
 * Grafana Data Source Plugin
 *
 * Provides alerts capability via Grafana webhook or Alertmanager API.
 * Alert storage is injected via setAlertStore() for server environments.
 */

import {
  type Alert,
  type AlertmanagerAlert,
  type AlertQueryOptions,
  type AlertsCapable,
  addHttpWarning,
  type ConnectionInfoCapable,
  type ConnectionInfoContext,
  type ConnectionInfoItem,
  type ConnectionResult,
  type DataSourceCapability,
  type DataSourcePlugin,
  parseAlertmanagerAlerts,
} from '@shumoku/core'
import type { AlertStoreService, GrafanaPluginConfig, GrafanaWebhookPayload } from './types.js'

// ============================================
// Helper Functions
// ============================================

// Severity mapping, title, and label filtering now come from
// @shumoku/core/plugin-kit (mapAlertmanagerSeverity / severityRank /
// buildAlertTitle / filterAlertLabels) via parseAlertmanagerAlerts — one shared
// Alertmanager dialect, no local copy.

/**
 * Validate an inbound Grafana webhook payload before it is processed. The
 * plugin owns its webhook shape (the server must not blind-cast arbitrary JSON
 * into `GrafanaWebhookPayload`). Returns a type predicate so callers can reject
 * malformed bodies with 400 instead of crashing downstream.
 */
export function isGrafanaWebhookPayload(body: unknown): body is GrafanaWebhookPayload {
  if (typeof body !== 'object' || body === null) return false
  const payload = body as Record<string, unknown>
  if (payload['status'] !== 'firing' && payload['status'] !== 'resolved') return false
  if (!Array.isArray(payload['alerts'])) return false
  return payload['alerts'].every((alert) => {
    if (typeof alert !== 'object' || alert === null) return false
    const a = alert as Record<string, unknown>
    return (
      (a['status'] === 'firing' || a['status'] === 'resolved') &&
      typeof a['fingerprint'] === 'string' &&
      typeof a['startsAt'] === 'string' &&
      typeof a['labels'] === 'object' &&
      a['labels'] !== null
    )
  })
}

// ============================================
// Plugin Class
// ============================================

export class GrafanaPlugin implements DataSourcePlugin, AlertsCapable, ConnectionInfoCapable {
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
   * Derived, display-only info: the webhook URL to paste into a Grafana
   * Contact Point. Built from the stored secret + the host-supplied origin (it
   * can't be a config input). The host renders this generically via
   * getConnectionInfo — no grafana-specific UI branch.
   */
  getConnectionInfo(config: unknown, ctx: ConnectionInfoContext): ConnectionInfoItem[] {
    const cfg = config as GrafanaPluginConfig | null
    if (!cfg?.useWebhook || !cfg.webhookSecret) return []
    return [
      {
        label: 'Webhook URL',
        value: `${ctx.serverOrigin}/api/webhooks/grafana/${cfg.webhookSecret}`,
        copyable: true,
      },
    ]
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

      // Grafana's bundled Alertmanager speaks the standard /api/v2/alerts
      // shape, so the shared parser handles it (filters + severity + labels).
      const raw = (await response.json()) as AlertmanagerAlert[]
      return parseAlertmanagerAlerts(raw, { source: 'grafana', query: options })
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
