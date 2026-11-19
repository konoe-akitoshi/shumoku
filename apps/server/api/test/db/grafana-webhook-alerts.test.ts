// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { register as registerGrafana } from 'shumoku-plugin-grafana'
import { createDataSourceOperationsService } from '../../src/app/data-source-operations.ts'
import { createShareApplicationService } from '../../src/app/share.ts'
import { createWebhookApplicationService } from '../../src/app/webhooks.ts'
import { pluginRegistry } from '../../src/plugins/registry.ts'
import { DashboardService } from '../../src/services/dashboard.ts'
import { DataSourceService } from '../../src/services/datasource.ts'
import { GrafanaAlertService } from '../../src/services/grafana-alerts.ts'
import type { ObservationsService } from '../../src/services/observations.ts'
import type { TopologyService } from '../../src/services/topology.ts'
import type { TopologySourcesService } from '../../src/services/topology-sources.ts'
import { setupTempDb, type TempDb } from './helper.ts'

/**
 * Alerts pushed to a webhook-mode data source are read back through the same store: the webhook
 * route writes it, and the plugin the Server creates for that source reads it.
 */
describe('alerts pushed by a Grafana webhook', () => {
  let db: TempDb
  beforeAll(() => {
    db = setupTempDb()
    if (!pluginRegistry.has('grafana')) registerGrafana(pluginRegistry)
  })
  afterAll(() => db.teardown())

  test('are returned by the data source and by a shared dashboard', async () => {
    const grafanaAlerts = new GrafanaAlertService()
    const dataSources = new DataSourceService({ alertStore: grafanaAlerts })
    const dashboards = new DashboardService()
    const source = await dataSources.create({
      name: 'Grafana',
      type: 'grafana',
      configJson: JSON.stringify({
        url: 'http://grafana.invalid',
        useWebhook: true,
        webhookSecret: 'secret-1',
      }),
    })

    const webhooks = createWebhookApplicationService({
      topologies: {} as TopologyService,
      sources: {} as TopologySourcesService,
      dataSources,
      observations: {} as ObservationsService,
      grafanaAlerts,
    })
    const pushed = await webhooks.handle('grafana', source.id, 'secret-1', {
      status: 'firing',
      alerts: [
        {
          status: 'firing',
          fingerprint: 'fp-1',
          startsAt: new Date().toISOString(),
          labels: { alertname: 'LinkDown', severity: 'critical', instance: 'sw1' },
          annotations: { summary: 'uplink down' },
        },
      ],
    })
    expect(pushed).toMatchObject({ ok: true, value: { alertCount: 1 } })

    // GET /api/datasources/:id/alerts
    const operations = createDataSourceOperationsService(dataSources, {
      ingestAlerts: async () => {},
    })
    const alerts = await operations.getAlerts(source.id, {})
    expect(alerts?.map((a) => a.id)).toEqual(['fp-1'])
    expect(alerts?.[0]).toMatchObject({ severity: 'critical', status: 'active' })

    // GET /api/share/dashboards/:token/datasources/:id/alerts
    const dashboard = await dashboards.create({
      name: 'board',
      layoutJson: JSON.stringify({ widgets: [{ config: { dataSourceId: source.id } }] }),
    })
    const token = await dashboards.share(dashboard.id)
    if (!token) throw new Error('dashboard was not shared')
    const share = createShareApplicationService({
      topologies: {} as TopologyService,
      dashboards,
      dataSources,
    })
    const shared = await share.dashboardAlerts(token, source.id, {})
    expect(shared.ok).toBe(true)
    expect((shared as { value: { id: string }[] }).value.map((a) => a.id)).toEqual(['fp-1'])
  })
})
