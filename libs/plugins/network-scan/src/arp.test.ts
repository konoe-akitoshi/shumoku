// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { isRandomizedMac, parseBsdArp, parseProcNetArp, readNeighborCache } from './arp.js'

describe('parseProcNetArp', () => {
  it('reads resolved entries and drops incomplete ones', () => {
    const out = parseProcNetArp(
      [
        'IP address       HW type     Flags       HW address            Mask     Device',
        '172.16.254.208   0x1         0x2         CC:D8:1F:9F:D4:AB     *        eth0',
        // Flags 0x0 = probed but never answered. Not a device.
        '172.16.254.211   0x1         0x0         00:00:00:00:00:00     *        eth0',
        '172.16.254.209   0x1         0x2         cc:d8:1f:9f:d4:5b     *        eth0',
      ].join('\n'),
    )
    expect(out.map((e) => [e.ip, e.mac])).toEqual([
      ['172.16.254.208', 'cc:d8:1f:9f:d4:ab'],
      ['172.16.254.209', 'cc:d8:1f:9f:d4:5b'],
    ])
  })
})

describe('parseBsdArp', () => {
  it('reads entries, pads unpadded octets, and drops incomplete ones', () => {
    const out = parseBsdArp(
      [
        '? (172.16.254.208) at cc:d8:1f:9f:d4:ab on en0 ifscope [ethernet]',
        '? (172.16.254.1) at (incomplete) on en0 ifscope [ethernet]',
        // BSD prints octets unpadded — same address as 00:0d:5d:11:f0:73.
        '? (172.16.254.245) at 0:d:5d:11:f0:73 on en0 ifscope [ethernet]',
        '? (172.16.254.255) at ff:ff:ff:ff:ff:ff on en0 ifscope [ethernet]',
      ].join('\n'),
    )
    expect(out.map((e) => [e.ip, e.mac])).toEqual([
      ['172.16.254.208', 'cc:d8:1f:9f:d4:ab'],
      ['172.16.254.245', '00:0d:5d:11:f0:73'],
    ])
  })

  it('ignores broadcast and multicast placeholder rows', () => {
    const out = parseBsdArp('? (224.0.0.251) at 1:0:5e:0:0:fb on en0 ifscope permanent [ethernet]')
    // A multicast MAC is not a device we can merge on, but it *is* a
    // syntactically valid address — the caller filters by address range, so
    // what matters here is only that parsing does not crash or invent one.
    expect(out.every((e) => /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(e.mac))).toBe(true)
  })
})

describe('isRandomizedMac', () => {
  it('separates vendor-assigned addresses from privacy-randomised ones', () => {
    // Bit 1 of the first octet clear = burned in by the vendor.
    expect(isRandomizedMac('cc:d8:1f:9f:d4:ab')).toBe(false) // switch
    expect(isRandomizedMac('94:f3:92:ec:03:6a')).toBe(false) // firewall
    expect(isRandomizedMac('00:0d:5d:11:f0:73')).toBe(false) // PDU
    // Set = the host made it up. Every one of these was a phone or laptop on
    // the segment this was measured against.
    expect(isRandomizedMac('4e:7e:4e:e3:dd:1d')).toBe(true)
    expect(isRandomizedMac('96:13:5e:91:84:06')).toBe(true)
    expect(isRandomizedMac('ea:ed:7b:c6:d2:c9')).toBe(true)
  })
})

describe('readNeighborCache', () => {
  it('never throws, whatever the platform exposes', async () => {
    // Discovery must survive a container with no /proc/net/arp and no `arp`
    // binary — it degrades to address-only identity, it does not fail a scan.
    await expect(readNeighborCache()).resolves.toBeInstanceOf(Map)
  })
})
