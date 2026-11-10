// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, test } from 'bun:test'
import type { SourceNetwork } from '@shumoku/core'
import { mergeReadIntoSnapshot } from '../../src/services/deep-read-service.ts'

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
    design: { nodes: {}, links: {} },
  }
}

const nothingAnswered: SourceNetwork = {
  network: { nodes: [], links: [] },
  observation: { nodes: {}, links: {} },
  design: { nodes: {}, links: {} },
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
