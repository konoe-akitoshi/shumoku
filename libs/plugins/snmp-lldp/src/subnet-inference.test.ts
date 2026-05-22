// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest'
import {
  type DeviceInterfaceIp,
  groupBySubnet,
  inferLinksFromSubnets,
  subnetCidr,
} from './subnet-inference.js'

describe('subnetCidr', () => {
  it('computes the CIDR of a /24', () => {
    expect(subnetCidr('192.168.13.15', '255.255.255.0')).toBe('192.168.13.0/24')
  })
  it('computes the CIDR of a /22 (the actual lab subnet)', () => {
    expect(subnetCidr('192.168.13.15', '255.255.252.0')).toBe('192.168.12.0/22')
  })
  it('skips loopback', () => {
    expect(subnetCidr('127.0.0.1', '255.0.0.0')).toBeNull()
  })
  it('skips link-local 169.254/16', () => {
    expect(subnetCidr('169.254.1.1', '255.255.0.0')).toBeNull()
  })
  it('skips /32 (host-only — no link information)', () => {
    expect(subnetCidr('192.50.27.3', '255.255.255.255')).toBeNull()
  })
  it('returns null on malformed input', () => {
    expect(subnetCidr('not-an-ip', '255.255.255.0')).toBeNull()
    expect(subnetCidr('1.2.3.4', '999.0.0.0')).toBeNull()
  })
})

describe('groupBySubnet + inferLinksFromSubnets', () => {
  // Mirrors the lab setup: four devices all on 192.168.12.0/22, plus
  // one device with a second interface in its own /24 (a router
  // interface that doesn 't see anyone else in the scan).
  const ifaces: DeviceInterfaceIp[] = [
    { nodeId: 'ix', portId: 'ix:p1', ip: '192.168.13.15', netmask: '255.255.252.0', ifIndex: 1314 },
    {
      nodeId: 'ix',
      portId: 'ix:p2',
      ip: '163.220.228.33',
      netmask: '255.255.255.248',
      ifIndex: 1313,
    },
    {
      nodeId: 'vyos',
      portId: 'vyos:eth0',
      ip: '192.168.13.22',
      netmask: '255.255.252.0',
      ifIndex: 2,
    },
    {
      nodeId: 'vyos',
      portId: 'vyos:eth5',
      ip: '192.168.20.13',
      netmask: '255.255.255.0',
      ifIndex: 5,
    },
    {
      nodeId: 'qnas-02',
      portId: 'qnas-02:eth0',
      ip: '192.168.13.27',
      netmask: '255.255.252.0',
      ifIndex: 2,
    },
    {
      nodeId: 'qnas-03',
      portId: 'qnas-03:eth0',
      ip: '192.168.13.28',
      netmask: '255.255.252.0',
      ifIndex: 2,
    },
    // Loopback should be dropped before grouping.
    { nodeId: 'vyos', portId: 'vyos:lo', ip: '127.0.0.1', netmask: '255.0.0.0', ifIndex: 1 },
  ]

  it('groups all four devices into the shared /22 and drops singletons', () => {
    const groups = groupBySubnet(ifaces)
    expect(groups).toHaveLength(1)
    expect(groups[0]?.cidr).toBe('192.168.12.0/22')
    expect(groups[0]?.members).toHaveLength(4)
    // 163.220.228.32/29 and 192.168.20.0/24 each have only one device → dropped.
    expect(groups.map((g) => g.cidr)).toEqual(['192.168.12.0/22'])
  })

  it('emits a mesh of pairwise inferred links across distinct devices', () => {
    const groups = groupBySubnet(ifaces)
    const links = inferLinksFromSubnets(groups)
    // 4 distinct nodes on the shared subnet → 4·3/2 = 6 unordered pairs.
    expect(links).toHaveLength(6)
    const pairs = new Set(links.map((l) => [l.from.nodeId, l.to.nodeId].sort().join('|')))
    expect(pairs).toEqual(
      new Set([
        'ix|vyos',
        'ix|qnas-02',
        'ix|qnas-03',
        'qnas-02|vyos',
        'qnas-03|vyos',
        'qnas-02|qnas-03',
      ]),
    )
    // Every link declares the subnet it was inferred from.
    for (const link of links) expect(link.subnet).toBe('192.168.12.0/22')
  })

  it('skips intra-device pairs even when both interfaces share a subnet', () => {
    const intra: DeviceInterfaceIp[] = [
      {
        nodeId: 'bridge',
        portId: 'bridge:a',
        ip: '10.0.0.1',
        netmask: '255.255.255.0',
        ifIndex: 1,
      },
      {
        nodeId: 'bridge',
        portId: 'bridge:b',
        ip: '10.0.0.2',
        netmask: '255.255.255.0',
        ifIndex: 2,
      },
    ]
    expect(groupBySubnet(intra)).toEqual([])
    expect(inferLinksFromSubnets(groupBySubnet(intra))).toEqual([])
  })
})
