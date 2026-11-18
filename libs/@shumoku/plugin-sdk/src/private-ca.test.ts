import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:https'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { createHttpClient } from './http-client.js'

let directory = ''
let ca = ''
let baseUrl = ''
let server: ReturnType<typeof createServer>
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'shumoku-ca-test-'))
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-days',
      '1',
      '-subj',
      '/CN=localhost',
      '-addext',
      'subjectAltName=DNS:localhost,IP:127.0.0.1',
      '-keyout',
      join(directory, 'key.pem'),
      '-out',
      join(directory, 'ca.pem'),
    ],
    { stdio: 'ignore' },
  )
  ca = await readFile(join(directory, 'ca.pem'), 'utf8')
  server = createServer(
    { key: await readFile(join(directory, 'key.pem')), cert: ca },
    (request, response) => {
      if (request.url === '/redirect') {
        response.writeHead(302, { Location: '/ok' })
        response.end()
        return
      }
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify({ ok: true }))
    },
  )
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('No test listener')
  baseUrl = `https://127.0.0.1:${address.port}`
})
afterAll(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()))
  if (directory) await rm(directory, { recursive: true })
})
it('trusts only the configured CA and does not follow redirects', async () => {
  const trusted = createHttpClient({ baseUrl, ca, redirect: 'error' })
  const untrusted = createHttpClient({ baseUrl, ca: 'not a certificate' })
  try {
    expect(await trusted.json('/ok')).toEqual({ ok: true })
    await expect(untrusted.json('/ok')).rejects.toThrow()
    await expect(trusted.json('/redirect')).rejects.toThrow()
  } finally {
    await trusted.dispose()
    await untrusted.dispose()
  }
})
it('refuses disabling verification when a CA is specified', async () => {
  const client = createHttpClient({ baseUrl, ca, insecure: true })
  await expect(client.json('/ok')).rejects.toThrow('cannot be combined')
})
