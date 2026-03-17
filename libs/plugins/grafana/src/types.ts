import type { Alert, AlertQueryOptions } from '@shumoku/core'

export interface GrafanaPluginConfig {
  url: string
  token: string
  /** Whether to receive alerts via webhook instead of Alertmanager API polling */
  useWebhook?: boolean
  webhookSecret?: string
}

/**
 * Grafana webhook payload structure
 */
export interface GrafanaWebhookPayload {
  status: 'firing' | 'resolved'
  alerts: GrafanaWebhookAlert[]
}

export interface GrafanaWebhookAlert {
  status: 'firing' | 'resolved'
  labels: Record<string, string>
  annotations?: Record<string, string>
  startsAt: string
  endsAt?: string
  fingerprint: string
  generatorURL?: string
}

/**
 * Alert store service interface for dependency injection.
 * Server implementations provide a DB-backed version;
 * the plugin can work without it (falls back to API polling).
 */
export interface AlertStoreService {
  getAlerts(dataSourceId: string, options?: AlertQueryOptions): Alert[]
  upsertFromWebhook(dataSourceId: string, payload: GrafanaWebhookPayload): number
  cleanup(maxAgeMs: number): number
}
