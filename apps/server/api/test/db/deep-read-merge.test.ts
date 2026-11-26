// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test'
import type { SourceNetwork } from '@shumoku/core'
import { keepReadable, mergeReadIntoSnapshot } from '../../src/services/deep-read-service.ts'

const READ = 'deep-read:node:10.0.0.1'
const OTHER = 'deep-read:node:10.0.0.2'
const PEER = 'deep-read:node:lldp:aa:aa:aa:aa:aa:aa'

function snapshot(links: Array<[string, string, string]>): SourceNetwork {
  const identity = (mgmtIp?: string) => ({ identity: mgmtIp ? { mgmtIp } : { chassisId: 'x' } })
  return {
    network: {
      nodes: [{ id: READ }, { id: OTHER }, { id: PEER }],
      links: links.map(([id, from, port]) => ({
        id,
        endpoints: [{ node: from, port }, { node: PEER }],
      })),
    },
    observation: {
      nodes: { [READ]: identity('10.0.0.1'), [OTHER]: identity('10.0.0.2'), [PEER]: identity() },
      links: {},
    },
  }
}

const nothingAnswered: SourceNetwork = {
  network: { nodes: [], links: [] },
  observation: { nodes: {}, links: {} },
}

describe('mergeReadIntoSnapshot', () => {
  test('a device whose LLDP table was read replaces its links', () => {
    const prior = snapshot([['old', READ, 'Ethernet8']])
    const fresh = snapshot([['new', READ, 'Ethernet8']])

    const merged = mergeReadIntoSnapshot(prior, fresh, new Set([READ]))

    expect(merged.network.links.map((l) => l.id)).toEqual(['new'])
  })

  test('links of a device this read did not touch are kept', () => {
    const prior = snapshot([['kept', OTHER, 'Ethernet1']])
    const fresh = snapshot([['new', READ, 'Ethernet8']])

    const merged = mergeReadIntoSnapshot(prior, fresh, new Set([READ]))

    expect(merged.network.links.map((l) => l.id).sort()).toEqual(['kept', 'new'])
  })

  test('a device whose LLDP walk failed keeps the links it had', () => {
    const prior = snapshot([['old', READ, 'Ethernet8']])

    const merged = mergeReadIntoSnapshot(prior, snapshot([]), new Set())

    expect(merged.network.links.map((l) => l.id)).toEqual(['old'])
  })

  test('a device that did not answer stays in the snapshot with its links', () => {
    const prior = snapshot([['old', READ, 'Ethernet8']])

    const merged = mergeReadIntoSnapshot(prior, nothingAnswered, new Set())

    expect(merged.network.nodes.map((n) => n.id)).toContain(READ)
    expect(merged.network.links.map((l) => l.id)).toEqual(['old'])
  })
})

describe('keepReadable', () => {
  const read = { metadata: { readVia: 'snmp' } }
  const peer = { metadata: { syncState: 'notice' } }
  const PEER2 = 'deep-read:node:lldp:bb:bb:bb:bb:bb:bb'
  const net: SourceNetwork = {
    network: {
      nodes: [{ id: READ }, { id: OTHER }, { id: PEER }, { id: PEER2 }],
      links: [
        { id: 'r-p', endpoints: [{ node: READ, port: 'e1' }, { node: PEER }] },
        { id: 'r-p2', endpoints: [{ node: READ, port: 'e2' }, { node: PEER2 }] },
        { id: 'o-p2', endpoints: [{ node: OTHER, port: 'e1' }, { node: PEER2 }] },
        {
          id: 'r-o',
          endpoints: [
            { node: READ, port: 'e3' },
            { node: OTHER, port: 'e3' },
          ],
        },
      ],
    },
    observation: {
      nodes: { [READ]: read, [OTHER]: read, [PEER]: peer, [PEER2]: peer },
      links: { 'r-p': {}, 'r-p2': {}, 'o-p2': {}, 'r-o': {} },
    },
  }

  test('takes out a device that may not be read, its links and the neighbours only it reached', () => {
    const kept = keepReadable(net, (id) => id !== READ)
    expect(kept.network.nodes.map((n) => n.id).sort()).toEqual([OTHER, PEER2].sort())
    expect(kept.network.links.map((l) => l.id)).toEqual(['o-p2'])
    expect(Object.keys(kept.observation?.links ?? {})).toEqual(['o-p2'])
    expect(Object.keys(kept.observation?.nodes ?? {}).sort()).toEqual([OTHER, PEER2].sort())
  })

  test('leaves the snapshot as it is when every device may be read', () => {
    expect(keepReadable(net, () => true)).toBe(net)
  })

  test('never takes out a neighbour by itself: only the devices it read decide', () => {
    expect(keepReadable(net, (id) => id !== PEER)).toBe(net)
  })
})
