// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Phase A — credential-free reachability.
 *
 * Discovery has two layers that the rest of the pipeline keeps separate:
 *
 *   A. Reachability  — "is something alive at this address?" Answerable
 *      WITHOUT any SNMP credential. This module.
 *   B. SNMP read     — "can I actually walk it?" Needs a working
 *      community. `discover.ts` / `client.ts`.
 *
 * The split matters because SNMPv2c can't tell you whether it's usable
 * without a credential: a wrong community produces the same silence as a
 * dead host. So an address that answers A but not B is a *notice* — we
 * can see a device is there, but can't read it until the operator hands
 * it a credential. Surfacing those (instead of silently dropping them)
 * is the whole point of this layer.
 *
 * The probe is intentionally a swappable strategy. Today it's TCP
 * connect (portable, no raw sockets, works cross-subnet and on Windows).
 * Later we may swap in ICMP, or ARP for same-segment scans — callers
 * depend only on the `ReachabilityProbe` shape, not on how "alive" is
 * decided. See the design discussion: TCP connect is the LibreNMS-style
 * default; ARP only wins inside one L2 segment and needs raw sockets.
 */

import { connect, type Socket } from 'node:net'
import { mapWithConcurrency } from '@shumoku/core'

/**
 * TCP ports we knock on to decide "something's alive here". These are
 * the management surfaces that tend to ride alongside an SNMP agent on
 * network gear. SNMP itself (161) is UDP, so it can't be TCP-probed —
 * that's exactly what Phase B is for.
 */
export const DEFAULT_PROBE_PORTS = [22, 443, 80, 23, 830] as const

/** How many addresses to probe in parallel during the reachability pass. */
const REACHABILITY_CONCURRENCY = 32

export interface ReachabilityResult {
  reachable: boolean
  /** First port that completed a TCP handshake, for diagnostics. Unset
   *  when the host proved alive only via a refused connection. */
  via?: number
}

/**
 * Single-address reachability probe. Swappable: TCP connect today,
 * ICMP / ARP later. Resolves `reachable: true` as soon as the host's IP
 * stack responds in any way.
 */
export type ReachabilityProbe = (
  address: string,
  opts: { timeoutMs: number; ports?: readonly number[] },
) => Promise<ReachabilityResult>

/**
 * Default probe: race TCP connects across `ports`. The first port that
 * completes a handshake wins (`reachable: true`, `via` = that port). A
 * refused connection (RST) also proves the host is up — nmap's `-PS`
 * treats RST as "host up" — so we count it as reachable, just without a
 * usable service port to report. Only when every port times out (or the
 * network is unreachable) do we call the host down.
 */
export const tcpConnectProbe: ReachabilityProbe = (address, opts) => {
  const ports = opts.ports ?? DEFAULT_PROBE_PORTS
  if (ports.length === 0) return Promise.resolve({ reachable: false })

  return new Promise<ReachabilityResult>((resolve) => {
    let pending = ports.length
    let settled = false
    const sockets: Socket[] = []

    const cleanup = (): void => {
      for (const s of sockets) s.destroy()
    }
    const up = (via?: number): void => {
      if (settled) return
      settled = true
      cleanup()
      resolve(via !== undefined ? { reachable: true, via } : { reachable: true })
    }
    const downOne = (): void => {
      if (settled) return
      pending -= 1
      if (pending === 0) {
        settled = true
        cleanup()
        resolve({ reachable: false })
      }
    }

    for (const port of ports) {
      const sock = connect({ host: address, port })
      sockets.push(sock)
      sock.setTimeout(opts.timeoutMs)
      sock.once('connect', () => up(port))
      sock.once('timeout', () => downOne())
      sock.once('error', (err: NodeJS.ErrnoException) => {
        // ECONNREFUSED = host alive, that port closed → still "up".
        if (err.code === 'ECONNREFUSED') up()
        else downOne()
      })
    }
  })
}

/**
 * Probe many addresses in bounded-concurrency chunks. Returns only the
 * reachable ones, keyed by address, so callers can turn them into notice
 * nodes. Mirrors the chunking of `probeAlive` so a `/24` reachability
 * sweep stays in the low seconds rather than minutes.
 */
export async function probeReachable(
  addresses: readonly string[],
  opts: { timeoutMs: number; ports?: readonly number[]; probe?: ReachabilityProbe },
): Promise<Map<string, ReachabilityResult>> {
  const probe = opts.probe ?? tcpConnectProbe
  const out = new Map<string, ReachabilityResult>()
  // True bounded pool (starts the next address as soon as one finishes), vs the
  // old chunk-barrier that waited for the slowest probe in each chunk.
  const settled = await mapWithConcurrency(
    addresses,
    REACHABILITY_CONCURRENCY,
    async (addr) =>
      [addr, await probe(addr, { timeoutMs: opts.timeoutMs, ports: opts.ports })] as const,
  )
  for (const [addr, res] of settled) {
    if (res.reachable) out.set(addr, res)
  }
  return out
}
