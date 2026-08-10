// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Phase A, part two — MAC addresses from the kernel's neighbour cache.
 *
 * An address on its own is a weak identity. It moves with DHCP, and it is
 * usually not what another source knows the device by: a wireless controller
 * that has never seen a switch's management IP still knows its MAC, because
 * that is what its APs report over LLDP. So a swept host that carries only an
 * IP cannot merge onto the device another source already described, while the
 * same host carrying a MAC merges on the first sync.
 *
 * The kernel has that mapping already. Probing an on-link address forces ARP
 * resolution, so once the reachability pass has run, the neighbour cache holds
 * a MAC for every host on the collector's own segment. Reading it back costs
 * nothing and needs no privileges — sending ARP ourselves would need a raw
 * socket.
 *
 * The limitation is inherent rather than incidental: ARP is link-local, so an
 * address reached through a router has no entry and that host stays MAC-less.
 * The answer is a collector on each segment worth resolving, not a workaround
 * here.
 */

import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { normalizeMacKey } from '@shumoku/core'

const execFileAsync = promisify(execFile)

/** Where Linux exposes the ARP cache without shelling out. */
const PROC_NET_ARP = '/proc/net/arp'

export interface NeighborEntry {
  ip: string
  /** Canonical (lowercase, colon-separated) MAC. */
  mac: string
  /**
   * The locally-administered bit is set. In practice that means a privacy
   * randomised address — a phone or a laptop, not infrastructure. Callers use
   * it to keep client churn out of a topology diagram.
   */
  randomized: boolean
}

/**
 * Is this a locally-administered (in practice, randomised) address?
 *
 * Bit 1 of the first octet distinguishes an address assigned by its vendor
 * from one the host made up. Every modern phone and laptop randomises its MAC
 * per network, and none of them are part of the topology being drawn.
 */
export function isRandomizedMac(mac: string): boolean {
  const first = Number.parseInt(mac.slice(0, 2), 16)
  return Number.isInteger(first) && (first & 0b10) !== 0
}

function entry(ip: string, rawMac: string): NeighborEntry | undefined {
  const mac = normalizeMacKey(rawMac)
  // Anything that did not canonicalise is not a MAC — an incomplete entry, or
  // a placeholder the platform prints for an unresolved address.
  if (!/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(mac)) return undefined
  if (mac === '00:00:00:00:00:00' || mac === 'ff:ff:ff:ff:ff:ff') return undefined
  return { ip, mac, randomized: isRandomizedMac(mac) }
}

/**
 * Parse Linux `/proc/net/arp`.
 *
 * ```
 * IP address       HW type     Flags       HW address            Mask     Device
 * 10.0.0.1         0x1         0x2         cc:d8:1f:9f:d4:ab     *        eth0
 * ```
 *
 * Flags `0x0` marks an incomplete entry — the address was probed but never
 * answered — so those are dropped rather than reported as a device.
 */
export function parseProcNetArp(text: string): NeighborEntry[] {
  const out: NeighborEntry[] = []
  for (const line of text.split('\n').slice(1)) {
    const cols = line.trim().split(/\s+/)
    if (cols.length < 4) continue
    const [ip, , flags, mac] = cols
    if (!ip || !mac || flags === '0x0') continue
    const e = entry(ip, mac)
    if (e) out.push(e)
  }
  return out
}

/**
 * Parse BSD / macOS `arp -an`.
 *
 * ```
 * ? (10.0.0.1) at cc:d8:1f:9f:d4:ab on en0 ifscope [ethernet]
 * ? (10.0.0.2) at (incomplete) on en0 ifscope [ethernet]
 * ```
 *
 * Octets come through unpadded (`0:d:5d:11:f0:73`); `normalizeMacKey` handles
 * that spelling.
 */
export function parseBsdArp(text: string): NeighborEntry[] {
  const out: NeighborEntry[] = []
  const re = /\((\d{1,3}(?:\.\d{1,3}){3})\)\s+at\s+([0-9a-f]{1,2}(?::[0-9a-f]{1,2}){5})/gi
  for (const line of text.split('\n')) {
    re.lastIndex = 0
    const m = re.exec(line)
    if (!m?.[1] || !m[2]) continue
    const e = entry(m[1], m[2])
    if (e) out.push(e)
  }
  return out
}

/**
 * Read the neighbour cache, keyed by IP.
 *
 * Never throws: a platform that exposes neither source (or a container with
 * the command absent) yields an empty map, and discovery carries on with
 * address-only identity rather than failing the scan.
 */
export async function readNeighborCache(): Promise<Map<string, NeighborEntry>> {
  const entries = (await readProcNetArp()) ?? (await readBsdArp()) ?? []
  return new Map(entries.map((e) => [e.ip, e]))
}

async function readProcNetArp(): Promise<NeighborEntry[] | undefined> {
  try {
    return parseProcNetArp(await readFile(PROC_NET_ARP, 'utf8'))
  } catch {
    return undefined
  }
}

async function readBsdArp(): Promise<NeighborEntry[] | undefined> {
  try {
    // `-n` keeps it from reverse-resolving every address, which on a cold
    // cache turns a millisecond read into a DNS-bound one.
    const { stdout } = await execFileAsync('arp', ['-an'], { timeout: 5000 })
    return parseBsdArp(stdout)
  } catch {
    return undefined
  }
}
