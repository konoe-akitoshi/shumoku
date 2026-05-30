// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { createServer, type Server } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { probeReachable, tcpConnectProbe } from './reachability.js'

/** Bind a throwaway TCP listener on 127.0.0.1 and return its port. */
function listen(): Promise<{ server: Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') resolve({ server, port: addr.port })
      else reject(new Error('no port'))
    })
  })
}

describe('tcpConnectProbe', () => {
  let server: Server
  let openPort: number

  beforeAll(async () => {
    const bound = await listen()
    server = bound.server
    openPort = bound.port
  })

  afterAll(() => {
    server.close()
  })

  it('reports reachable with the open port as `via` on a successful handshake', async () => {
    const res = await tcpConnectProbe('127.0.0.1', { timeoutMs: 1000, ports: [openPort] })
    expect(res.reachable).toBe(true)
    expect(res.via).toBe(openPort)
  })

  it('treats a refused connection as host-up (reachable, no `via`)', async () => {
    // A closed port on loopback refuses (RST) immediately — the IP stack
    // answered, so the host is up even though nothing listens there.
    const closedPort = openPort === 65535 ? openPort - 1 : openPort + 1
    const res = await tcpConnectProbe('127.0.0.1', { timeoutMs: 1000, ports: [closedPort] })
    expect(res.reachable).toBe(true)
    expect(res.via).toBeUndefined()
  })

  it('is reachable when any probed port answers, open or closed', async () => {
    // Whichever port's IP-stack response lands first wins the race — a
    // fast RST from the closed port may short-circuit before the open
    // port's handshake completes, so `via` is best-effort, not assured.
    const closedPort = openPort === 65535 ? openPort - 1 : openPort + 1
    const res = await tcpConnectProbe('127.0.0.1', {
      timeoutMs: 1000,
      ports: [closedPort, openPort],
    })
    expect(res.reachable).toBe(true)
  })

  it('is unreachable when there are no ports to probe', async () => {
    const res = await tcpConnectProbe('127.0.0.1', { timeoutMs: 1000, ports: [] })
    expect(res.reachable).toBe(false)
  })
})

describe('probeReachable', () => {
  it('returns an empty map for no addresses', async () => {
    const out = await probeReachable([], { timeoutMs: 1000 })
    expect(out.size).toBe(0)
  })

  it('keys reachable addresses and drops unreachable ones (custom probe)', async () => {
    // Inject a deterministic probe so the runner is tested without real
    // sockets: odd-last-octet = reachable, even = down.
    const out = await probeReachable(['10.0.0.1', '10.0.0.2', '10.0.0.3'], {
      timeoutMs: 1000,
      probe: (addr) =>
        Promise.resolve(
          Number(addr.split('.').at(-1)) % 2 === 1
            ? { reachable: true, via: 22 }
            : { reachable: false },
        ),
    })
    expect([...out.keys()].sort()).toEqual(['10.0.0.1', '10.0.0.3'])
    expect(out.get('10.0.0.1')?.via).toBe(22)
  })
})
