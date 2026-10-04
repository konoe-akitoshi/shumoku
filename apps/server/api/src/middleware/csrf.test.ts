import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { csrfGuard, hasAllowedWebSocketOrigin } from './csrf.js'

const HOST = 'shumoku.example:8080'

function createApp(): Hono {
  const app = new Hono()
  app.use('/api/*', csrfGuard)
  app.all('/api/plugins/upload', (c) => c.json({ ok: true }))
  app.all('/api/webhooks/grafana/source-1', (c) => c.json({ ok: true }))
  return app
}

async function request(
  headers: Record<string, string>,
  init: { method?: string; path?: string; body?: BodyInit } = {},
): Promise<Response> {
  return createApp().request(`http://${HOST}${init.path ?? '/api/plugins/upload'}`, {
    method: init.method ?? 'POST',
    headers: { Host: HOST, ...headers },
    body: init.body,
  })
}

describe('csrfGuard', () => {
  it.each(['same-origin', 'none'])('accepts Sec-Fetch-Site: %s', async (site) => {
    expect((await request({ 'Sec-Fetch-Site': site })).status).toBe(200)
  })

  it.each(['same-site', 'future-value'])('rejects Sec-Fetch-Site: %s', async (site) => {
    expect((await request({ 'Sec-Fetch-Site': site })).status).toBe(403)
  })

  it('trusts Sec-Fetch-Site over an Origin that matches the Host', async () => {
    const response = await request({
      'Sec-Fetch-Site': 'same-site',
      Origin: `http://${HOST}`,
    })
    expect(response.status).toBe(403)
  })

  it('accepts an Origin whose host matches the Host header when Sec-Fetch-Site is absent', async () => {
    expect((await request({ Origin: `http://${HOST}` })).status).toBe(200)
  })

  it.each([
    ['another host', 'http://attacker.example:8080'],
    ['another port', 'http://shumoku.example:3000'],
    ['an opaque origin', 'null'],
    ['an empty Origin header', ''],
  ])('rejects an Origin from %s', async (_label, origin) => {
    expect((await request({ Origin: origin })).status).toBe(403)
  })

  it('accepts requests without Sec-Fetch-Site or Origin (non-browser clients)', async () => {
    expect((await request({})).status).toBe(200)
  })

  it.each([
    ['GET', 200],
    ['HEAD', 200],
    ['OPTIONS', 200],
    ['PUT', 403],
    ['PATCH', 403],
    ['DELETE', 403],
  ])('answers a cross-site %s with %i', async (method, status) => {
    const response = await request(
      { 'Sec-Fetch-Site': 'cross-site', Origin: 'https://attacker.example' },
      { method },
    )
    expect(response.status).toBe(status)
  })

  it('lets webhooks through from a cross-site sender', async () => {
    const response = await request(
      { 'Sec-Fetch-Site': 'cross-site', Origin: 'https://alertmanager.example' },
      { path: '/api/webhooks/grafana/source-1' },
    )
    expect(response.status).toBe(200)
  })

  it.each(['/api/plugins/upload?next=/api/webhooks/x', '/api/webhooks-admin'])(
    'does not exempt %s, which only looks like a webhook',
    async (path) => {
      const response = await request({ 'Sec-Fetch-Site': 'cross-site' }, { path })
      expect(response.status).toBe(403)
    },
  )

  it('answers with the API error shape', async () => {
    const response = await request({ 'Sec-Fetch-Site': 'cross-site' })
    expect(response.status).toBe(403)
    expect(response.headers.get('X-Request-ID')).toEqual(expect.any(String))
    expect(await response.json()).toMatchObject({
      error: 'Cross-origin request blocked',
      requestId: expect.any(String),
    })
  })
})

describe('hasAllowedWebSocketOrigin', () => {
  const req = (headers: Record<string, string>) => new Request(`http://${HOST}/ws`, { headers })

  it.each([
    ['no Origin (a non-browser client)', { Host: HOST }, true],
    ['its own origin', { Host: HOST, Origin: `http://${HOST}` }, true],
    ['another host', { Host: HOST, Origin: 'http://attacker.example' }, false],
    ['an Origin but no Host', { Origin: `http://${HOST}` }, false],
  ])('given %s, answers %s', (_label, headers, allowed) => {
    expect(hasAllowedWebSocketOrigin(req(headers))).toBe(allowed)
  })
})
