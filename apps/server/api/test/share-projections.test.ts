// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test'
import type { Alert, NetworkGraph } from '@shumoku/core'
import {
  publicAlert,
  publicDashboardLayout,
  publicMetrics,
  publicTopologyContext,
  publicTopologyGraph,
} from '../src/api/share-projections.ts'
import type { ParsedTopology } from '../src/services/topology.ts'
import type { MetricsData } from '../src/types.ts'

describe('publicTopologyGraph — strips sensitive carriers from the shared graph', () => {
  const graph = {
    version: '1',
    name: 'secret-net',
    attachments: [{ kind: 'policy', mode: 'auto' }], // topology-default policy → must drop
    exclusions: [{ mgmtIp: '10.9.9.9' }], // hidden node's mgmt identity → must drop
    nodes: [
      {
        id: 'sw1',
        label: 'core-sw',
        identity: { mgmtIp: '10.0.0.1', chassisId: 'aa:bb', sysName: 'core-sw.local' },
        metadata: { rack: 'R1', location: 'NOC#N-1' },
        attachments: [{ kind: 'access', community: 'SUPERSECRET' }], // SNMP community → must drop
        ports: [
          {
            id: 'p1',
            label: 'Gi0/1',
            identity: { ifIndex: '1' },
            attachments: [{ kind: 'access', community: 'PORTSECRET' }],
          },
        ],
      },
    ],
    links: [
      {
        id: 'l1',
        from: { node: 'sw1', port: 'p1', ip: '10.0.0.1/30' },
        to: { node: 'sw2', ip: '10.0.0.2/30' },
      },
    ],
    subgraphs: [{ id: 'g1', label: 'Site A', attachments: [{ kind: 'access', community: 'X' }] }],
  } as unknown as NetworkGraph

  const parsed = { id: 't1', name: 'secret-net', graph } as unknown as ParsedTopology
  const out = publicTopologyGraph(parsed).graph
  const blob = JSON.stringify(out)

  test('no SNMP community anywhere in the output', () => {
    expect(blob).not.toContain('SUPERSECRET')
    expect(blob).not.toContain('PORTSECRET')
    expect(blob.toLowerCase()).not.toContain('community')
  })
  test('no node/port identity, metadata (except location), or endpoint ip', () => {
    expect(blob).not.toContain('mgmtIp')
    expect(blob).not.toContain('chassisId')
    expect(blob).not.toContain('sysName')
    expect(blob).not.toContain('10.0.0.1/30')
    expect(out.nodes[0]).not.toHaveProperty('identity')
    expect(out.nodes[0]).not.toHaveProperty('attachments')
    expect(out.nodes[0]?.ports?.[0]).not.toHaveProperty('attachments')
    // metadata is allow-listed down to the layout-bearing zone name:
    // the composite layout needs `location`, and the zone label is
    // drawn on the shared diagram anyway. Everything else must drop.
    expect(blob).not.toContain('R1')
    expect(out.nodes[0]?.metadata).toEqual({ location: 'NOC#N-1' })
  })
  test('no graph-level attachments or exclusions', () => {
    expect(out).not.toHaveProperty('attachments')
    expect(out).not.toHaveProperty('exclusions')
    expect(blob).not.toContain('10.9.9.9')
  })
  test('keeps render-relevant structure', () => {
    expect(out.nodes[0]?.id).toBe('sw1')
    expect(out.nodes[0]?.label).toBe('core-sw')
    expect(out.nodes[0]?.ports?.[0]?.id).toBe('p1')
    expect(out.links[0]?.from.node).toBe('sw1')
    expect(out.links[0]?.to.node).toBe('sw2')
  })
})

describe('publicAlert — allow-listed', () => {
  const alert = {
    id: 'a1',
    severity: 'high',
    status: 'firing',
    title: 'Link down',
    description: 'snmpwalk to 10.0.0.1 community SECRET failed',
    host: 'core-sw',
    hostId: 'zbx-12345',
    nodeId: 'sw1',
    startTime: 1000,
    endTime: 2000,
    source: 'zabbix',
    url: 'https://internal-zabbix.local/alert/1',
    labels: { internal_team: 'noc', runbook: 'http://wiki.internal/x' },
    receivedAt: 1500,
  } as unknown as Alert

  const out = publicAlert(alert)
  const blob = JSON.stringify(out)

  test('keeps only display + mapping fields', () => {
    expect(out).toEqual({
      id: 'a1',
      severity: 'high',
      status: 'firing',
      title: 'Link down',
      host: 'core-sw',
      nodeId: 'sw1',
      startTime: 1000,
      endTime: 2000,
    })
  })
  test('drops description / url / labels / source / hostId / receivedAt', () => {
    for (const leak of [
      'SECRET',
      'zbx-12345',
      'internal-zabbix',
      'wiki.internal',
      'zabbix',
      'snmpwalk',
    ]) {
      expect(blob).not.toContain(leak)
    }
  })
})

describe('publicDashboardLayout — allow-listed widget config', () => {
  test('keeps known config keys, drops unknown ones', () => {
    const raw = JSON.stringify({
      columns: 12,
      rowHeight: 40,
      margin: 8,
      widgets: [
        {
          id: 'w1',
          type: 'topology',
          position: { x: 0, y: 0, w: 6, h: 4 },
          config: {
            topologyId: 't1',
            showLabels: true,
            // unknown / potentially sensitive keys:
            query: 'SELECT * WHERE secret',
            internalUrl: 'http://wiki.internal',
            apiToken: 'abcd',
          },
        },
      ],
    })
    const out = JSON.parse(publicDashboardLayout(raw))
    expect(out.widgets[0].config).toEqual({ topologyId: 't1', showLabels: true })
    const blob = JSON.stringify(out)
    expect(blob).not.toContain('secret')
    expect(blob).not.toContain('wiki.internal')
    expect(blob).not.toContain('apiToken')
    expect(out.columns).toBe(12)
  })
  test('malformed layout → empty widgets (no throw)', () => {
    expect(JSON.parse(publicDashboardLayout('not json'))).toEqual({ widgets: [] })
  })
})

describe('publicMetrics — node status only, link traffic kept, internals dropped', () => {
  const m = {
    nodes: {
      sw1: {
        status: 'up',
        monitoring: 'failing',
        monitoringError: 'SNMP timeout to 10.0.0.1:161 OID 1.3.6.1',
        cpu: 42,
        memory: 80,
        lastSeen: 1000,
        redundancy: { totalSources: 1, agreement: 'single' },
        observations: [
          {
            source: { id: 'private-source', name: 'Internal SNMP', type: 'prometheus' },
            timestamp: 1000,
            sample: { status: 'up', monitoringError: 'private path' },
          },
        ],
      },
    },
    links: {
      l1: { status: 'up', utilization: 50, inBps: 1000, outBps: 2000, inUtilization: 40 },
    },
    timestamp: 1234,
    warnings: ['Parse error: secret config text', 'Using insecure HTTP connection'],
  } as unknown as MetricsData

  const out = publicMetrics(m)
  const blob = JSON.stringify(out)

  test('node keeps ONLY status (drops monitoringError/monitoring/cpu/memory/lastSeen)', () => {
    expect(out.nodes.sw1).toEqual({ status: 'up' })
  })
  test('link keeps status + traffic numbers', () => {
    expect(out.links.l1).toEqual({
      status: 'up',
      utilization: 50,
      inUtilization: 40,
      inBps: 1000,
      outBps: 2000,
    })
  })
  test('drops warnings and any internal/error text', () => {
    expect(out.warnings).toBeUndefined()
    expect(blob).not.toContain('SNMP timeout')
    expect(blob).not.toContain('10.0.0.1')
    expect(blob).not.toContain('secret config')
    expect(blob).not.toContain('monitoringError')
    expect(blob).not.toContain('private-source')
    expect(blob).not.toContain('Internal SNMP')
    expect(blob).not.toContain('observations')
    expect(out.timestamp).toBe(1234)
  })
})

describe('publicTopologyContext — metrics are projected (regression: monitoringError leak)', () => {
  const parsed = {
    id: 't1',
    name: 'ctx',
    graph: {
      nodes: [{ id: 'sw1', label: 'core', spec: undefined }],
      links: [],
      subgraphs: [],
    },
    metrics: {
      nodes: {
        sw1: {
          status: 'down',
          monitoring: 'failing',
          monitoringError: 'SNMP timeout to 10.0.0.1:161',
          cpu: 5,
          lastSeen: 999,
        },
      },
      links: {},
      timestamp: 7,
      warnings: ['Parse error: internal config blob'],
    },
  } as unknown as ParsedTopology

  const out = publicTopologyContext(parsed)
  const blob = JSON.stringify(out)

  test('context metrics carry node status but NOT internal fields', () => {
    expect(out.metrics.nodes.sw1).toEqual({ status: 'down' })
    expect(out.metrics.warnings).toBeUndefined()
  })
  test('no monitoringError / SNMP text / parse-error blob leaks via /context', () => {
    expect(blob).not.toContain('monitoringError')
    expect(blob).not.toContain('SNMP timeout')
    expect(blob).not.toContain('10.0.0.1')
    expect(blob).not.toContain('internal config blob')
  })
})
