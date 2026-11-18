import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Server, ServerCredentials } from '@grpc/grpc-js'
import { describe, expect, it } from 'vitest'
import { collectHubble, hubbleMethod, hubbleOptions } from './hubble.js'

async function server(
  handler: Parameters<Server['addService']>[1]['getFlows'],
  creds = ServerCredentials.createInsecure(),
) {
  const server = new Server()
  server.addService({ getFlows: hubbleMethod }, { getFlows: handler })
  const port = await new Promise<number>((resolve, reject) =>
    server.bindAsync('127.0.0.1:0', creds, (error, port) =>
      error ? reject(error) : resolve(port),
    ),
  )
  return {
    server,
    options: { address: `127.0.0.1:${port}`, insecure: true, maxFlows: 10, timeoutMs: 1000 },
  }
}
describe('Hubble gRPC transport', () => {
  it('uses the official streaming wire contract, a bounded time window and namespace filters', async () => {
    let request: unknown
    const fixture = await server((call) => {
      request = call.request
      call.write({
        flow: {
          uuid: 'one',
          verdict: 'DROPPED',
          source: { namespace: 'demo', pod_name: 'web' },
          drop_reason_desc: 'POLICY_DENIED',
        },
      })
      call.write({ node_status: { state_change: 'NODE_CONNECTED', node_names: ['node1'] } })
      call.write({ lost_events: { num_events_lost: '3' } })
      call.write({ node_status: { state_change: 'NODE_UNAVAILABLE', node_names: ['node2'] } })
      call.end()
    })
    try {
      const result = await collectHubble(['demo'], 60, fixture.options)
      expect(result.flows[0]?.verdict).toBe('DROPPED')
      expect(result.lostEvents).toBe(3)
      expect(result.unavailableNodes).toBe(1)
      expect(result.until - result.since).toBe(60000)
      expect(request).toMatchObject({
        whitelist: [{ source_pod: ['demo/'] }, { destination_pod: ['demo/'] }],
      })
      expect(request).not.toHaveProperty('number')
      expect((request as { follow?: boolean }).follow ?? false).toBe(false)
    } finally {
      fixture.server.forceShutdown()
    }
  })
  it('cancels at the event cap and reports truncation', async () => {
    const fixture = await server((call) => {
      for (let i = 0; i < 20; i++) call.write({ flow: { uuid: String(i) } })
      call.end()
    })
    try {
      const result = await collectHubble([], 60, { ...fixture.options, maxFlows: 2 })
      expect(result.flows).toHaveLength(2)
      expect(result.truncated).toBe(true)
    } finally {
      fixture.server.forceShutdown()
    }
  })
  it('rejects incomplete queries on deadline and does not leak upstream errors', async () => {
    const fixture = await server(() => {})
    try {
      await expect(collectHubble([], 60, { ...fixture.options, timeoutMs: 30 })).rejects.toThrow(
        'Hubble Relay query failed',
      )
    } finally {
      fixture.server.forceShutdown()
    }
  })
  it('validates the Relay certificate with a private CA and rejects an untrusted server', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'shumoku-hubble-tls-'))
    const cert = join(dir, 'cert.pem')
    const key = join(dir, 'key.pem')
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        key,
        '-out',
        cert,
        '-days',
        '1',
        '-subj',
        '/CN=localhost',
        '-addext',
        'subjectAltName=DNS:localhost,IP:127.0.0.1',
      ],
      { stdio: 'ignore' },
    )
    const fixture = await server(
      (call) => call.end(),
      ServerCredentials.createSsl(
        null,
        [{ private_key: readFileSync(key), cert_chain: readFileSync(cert) }],
        false,
      ),
    )
    try {
      const options = {
        ...fixture.options,
        address: fixture.options.address.replace('127.0.0.1', 'localhost'),
        insecure: false,
        caFile: cert,
      }
      expect((await collectHubble([], 60, options)).flows).toEqual([])
      await expect(collectHubble([], 60, { ...options, caFile: undefined })).rejects.toThrow(
        'Hubble Relay query failed',
      )
    } finally {
      fixture.server.forceShutdown()
      rmSync(dir, { recursive: true, force: true })
    }
  })
  it('supports mutual TLS and rejects a missing client certificate', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'shumoku-hubble-mtls-'))
    const cert = join(dir, 'cert.pem')
    const key = join(dir, 'key.pem')
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        key,
        '-out',
        cert,
        '-days',
        '1',
        '-subj',
        '/CN=localhost',
        '-addext',
        'subjectAltName=DNS:localhost',
      ],
      { stdio: 'ignore' },
    )
    const fixture = await server(
      (call) => call.end(),
      ServerCredentials.createSsl(
        readFileSync(cert),
        [{ private_key: readFileSync(key), cert_chain: readFileSync(cert) }],
        true,
      ),
    )
    try {
      const options = {
        ...fixture.options,
        address: fixture.options.address.replace('127.0.0.1', 'localhost'),
        insecure: false,
        caFile: cert,
      }
      await expect(collectHubble([], 60, options)).rejects.toThrow('Hubble Relay query failed')
      expect(
        (await collectHubble([], 60, { ...options, certFile: cert, keyFile: key })).flows,
      ).toEqual([])
    } finally {
      fixture.server.forceShutdown()
      rmSync(dir, { recursive: true, force: true })
    }
  })
  it('requires explicit enablement and refuses inconsistent TLS configuration', () => {
    expect(() => hubbleOptions({})).toThrow('disabled')
    const env = { SHUMOKU_HUBBLE_ENABLED: 'true', SHUMOKU_HUBBLE_ADDRESS: 'relay.example:443' }
    expect(hubbleOptions(env).insecure).toBe(false)
    expect(() => hubbleOptions({ ...env, SHUMOKU_HUBBLE_KEY_FILE: '/tmp/key' })).toThrow('TLS')
    expect(() =>
      hubbleOptions({ ...env, SHUMOKU_HUBBLE_INSECURE: 'true', SHUMOKU_HUBBLE_CA_FILE: '/tmp/ca' }),
    ).toThrow('TLS')
    expect(() => hubbleOptions({ ...env, SHUMOKU_HUBBLE_ADDRESS: 'http://bad' })).toThrow(
      'host:port',
    )
  })
})
