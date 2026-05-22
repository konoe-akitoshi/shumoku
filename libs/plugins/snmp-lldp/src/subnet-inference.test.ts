// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { DeviceType } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import {
  buildSegmentInference,
  type DeviceInterfaceIp,
  groupBySubnet,
  subnetCidr,
} from './subnet-inference.js'

describe('subnetCidr', () => {
  it('computes the CIDR of a /24', () => {
    expect(subnetCidr('192.168.13.15', '255.255.255.0')).toBe('192.168.13.0/24')
  })
  it('computes the CIDR of a /22 (the lab subnet)', () => {
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

describe('groupBySubnet', () => {
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

  it('groups all four devices into the shared /22 and drops singleton subnets', () => {
    const groups = groupBySubnet(ifaces)
    expect(groups).toHaveLength(1)
    expect(groups[0]?.cidr).toBe('192.168.12.0/22')
    expect(groups[0]?.members).toHaveLength(4)
    expect(groups.map((g) => g.cidr)).toEqual(['192.168.12.0/22'])
  })
})

describe('buildSegmentInference', () => {
  const ifaces: DeviceInterfaceIp[] = [
    { nodeId: 'ix', portId: 'ix:p1', ip: '192.168.13.15', netmask: '255.255.252.0', ifIndex: 1314 },
    {
      nodeId: 'vyos',
      portId: 'vyos:eth0',
      ip: '192.168.13.22',
      netmask: '255.255.252.0',
      ifIndex: 2,
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
  ]

  it('emits one segment node + one spoke link per device for each shared subnet', () => {
    const groups = groupBySubnet(ifaces)
    const inference = buildSegmentInference(groups, 'snmp-lldp')
    expect(inference.segmentNodes).toHaveLength(1)
    expect(inference.spokeLinks).toHaveLength(4)
    const seg = inference.segmentNodes[0]
    expect(seg?.spec?.kind).toBe('hardware')
    expect((seg?.spec as { type?: string })?.type).toBe(DeviceType.Segment)
    expect(seg?.label).toBe('192.168.12.0/22')
    expect(seg?.ports).toHaveLength(4)
  })

  it('respects the "1 port = 1 link endpoint" invariant', () => {
    const groups = groupBySubnet(ifaces)
    const inference = buildSegmentInference(groups, 'snmp-lldp')
    // No port id should appear twice across the spoke links — both the
    // device-side and the segment-side.
    const portUses = new Map<string, number>()
    for (const link of inference.spokeLinks) {
      for (const endpoint of [link.from, link.to]) {
        const key = `${endpoint.node}|${endpoint.port}`
        portUses.set(key, (portUses.get(key) ?? 0) + 1)
      }
    }
    for (const [_, count] of portUses) expect(count).toBe(1)
  })

  it('stamps subnet metadata on the segment node and each spoke link', () => {
    const groups = groupBySubnet(ifaces)
    const inference = buildSegmentInference(groups, 'snmp-lldp')
    expect(inference.segmentNodes[0]?.metadata?.['subnet']).toBe('192.168.12.0/22')
    for (const link of inference.spokeLinks) {
      expect(link.metadata?.['linkType']).toBe('subnet-inferred')
      expect(link.metadata?.['subnet']).toBe('192.168.12.0/22')
    }
  })

  it('produces deterministic segment node ids from the CIDR', () => {
    const groups = groupBySubnet(ifaces)
    const inference = buildSegmentInference(groups, 'snmp-lldp')
    expect(inference.segmentNodes[0]?.id).toBe('snmp-lldp:segment:192.168.12.0_22')
  })
})
