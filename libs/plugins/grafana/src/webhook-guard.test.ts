import { describe, expect, it } from 'vitest'
import { GrafanaPlugin, isGrafanaWebhookPayload } from './plugin.js'

const validAlert = {
  status: 'firing',
  fingerprint: 'fp1',
  startsAt: '2020-01-01T00:00:00Z',
  labels: { alertname: 'HighCPU' },
}

describe('isGrafanaWebhookPayload', () => {
  it('accepts a well-formed payload (incl. an empty alert batch)', () => {
    expect(isGrafanaWebhookPayload({ status: 'firing', alerts: [validAlert] })).toBe(true)
    expect(isGrafanaWebhookPayload({ status: 'resolved', alerts: [] })).toBe(true)
  })

  it('rejects non-objects, bad status, or missing alerts', () => {
    expect(isGrafanaWebhookPayload(null)).toBe(false)
    expect(isGrafanaWebhookPayload('nope')).toBe(false)
    expect(isGrafanaWebhookPayload({ status: 'bogus', alerts: [] })).toBe(false)
    expect(isGrafanaWebhookPayload({ status: 'firing' })).toBe(false)
  })

  it('rejects alerts missing required fields', () => {
    expect(isGrafanaWebhookPayload({ status: 'firing', alerts: [{ status: 'firing' }] })).toBe(
      false,
    )
    expect(
      isGrafanaWebhookPayload({
        status: 'firing',
        alerts: [{ ...validAlert, labels: null }],
      }),
    ).toBe(false)
  })
})

describe('GrafanaPlugin.getConnectionInfo', () => {
  const ctx = { dataSourceId: 'ds1', serverOrigin: 'https://shumoku.example.com' }
  const plugin = new GrafanaPlugin()

  it('builds the webhook URL from the stored secret + host origin', () => {
    expect(
      plugin.getConnectionInfo(
        { url: 'https://g', token: 't', useWebhook: true, webhookSecret: 'sek' },
        ctx,
      ),
    ).toEqual([
      {
        label: 'Webhook URL',
        value: 'https://shumoku.example.com/api/webhooks/grafana/sek',
        copyable: true,
      },
    ])
  })

  it('returns nothing when webhook is off or no secret yet', () => {
    expect(
      plugin.getConnectionInfo({ url: 'https://g', token: 't', useWebhook: false }, ctx),
    ).toEqual([])
    expect(
      plugin.getConnectionInfo({ url: 'https://g', token: 't', useWebhook: true }, ctx),
    ).toEqual([])
  })
})
