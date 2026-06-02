// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { NetworkGraph, Node } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { mergeProbeIntoSnapshot } from './probe-merge.js'

function graph(nodes: Node[], links: NetworkGraph['links'] = []): NetworkGraph {
  return { version: '1', nodes, links }
}

function node(id: string, mgmtIp: string, label = id): Node {
  return { id, label, shape: 'rect', identity: { mgmtIp } }
}

describe('mergeProbeIntoSnapshot (C10 — identity match)', () => {
  it('falls back to the probe graph when there is no usable base', () => {
    const probe = graph([node('p1', '10.0.0.1')])
    expect(mergeProbeIntoSnapshot(null, probe, [])).toBe(probe)
    expect(mergeProbeIntoSnapshot(graph([]), probe, [])).toBe(probe)
  })

  it('replaces the matching device by identity even when the scan re-numbered its id', () => {
    // base saw the device as discovered:5; the probe re-numbered it to
    // discovered:9 but it's the same mgmtIp. Old id-matching left a duplicate.
    const base = graph([{ ...node('discovered:5', '10.0.0.1', 'old-name') }])
    const probe = graph([{ ...node('discovered:9', '10.0.0.1', 'new-name') }])
    const out = mergeProbeIntoSnapshot(base, probe, ['10.0.0.1'])
    expect(out?.nodes).toHaveLength(1) // not 2 — the stale base node is gone
    expect(out?.nodes[0]?.id).toBe('discovered:9')
    expect(out?.nodes[0]?.label).toBe('new-name')
  })

  it('keeps unrelated base nodes when a probe re-reads one device', () => {
    const base = graph([node('a', '10.0.0.1'), node('b', '10.0.0.2')])
    // probe re-reads A under a fresh id.
    const probe = graph([node('a-new', '10.0.0.1', 'A2')])
    const out = mergeProbeIntoSnapshot(base, probe, ['10.0.0.1'])
    const ips = (out?.nodes ?? []).map((n) => n.identity?.mgmtIp).sort()
    expect(ips).toEqual(['10.0.0.1', '10.0.0.2']) // B preserved, A refreshed once
    expect(out?.nodes.find((n) => n.identity?.mgmtIp === '10.0.0.2')?.id).toBe('b')
  })

  it('drops base links incident to a re-probed device; unrelated links survive', () => {
    const base = graph(
      [node('a', '10.0.0.1'), node('b', '10.0.0.2'), node('c', '10.0.0.3')],
      [
        { id: 'a-b', from: { node: 'a', port: 'pa' }, to: { node: 'b', port: 'pb' } },
        { id: 'b-c', from: { node: 'b', port: 'pb' }, to: { node: 'c', port: 'pc' } },
      ],
    )
    // probe re-reads B (re-numbered). Both base links touch B → dropped.
    const probe = graph([node('b-new', '10.0.0.2', 'B2')])
    const out = mergeProbeIntoSnapshot(base, probe, ['10.0.0.2'])
    expect(out?.links).toHaveLength(0)
    // no surviving link references the stale base id 'b'
    expect((out?.links ?? []).some((l) => l.from.node === 'b' || l.to.node === 'b')).toBe(false)

    // A probe of C leaves the A-B link (which doesn't touch C) intact.
    const probeC = graph([node('c-new', '10.0.0.3', 'C2')])
    const out2 = mergeProbeIntoSnapshot(base, probeC, ['10.0.0.3'])
    expect((out2?.links ?? []).map((l) => l.id)).toEqual(['a-b'])
  })

  it('falls back to id match for nodes without a usable identity', () => {
    const base = graph([{ id: 'x', label: 'x', shape: 'rect' }])
    const probe = graph([{ id: 'x', label: 'x-fresh', shape: 'rect' }])
    const out = mergeProbeIntoSnapshot(base, probe, [])
    expect(out?.nodes).toHaveLength(1)
    expect(out?.nodes[0]?.label).toBe('x-fresh')
  })
})
