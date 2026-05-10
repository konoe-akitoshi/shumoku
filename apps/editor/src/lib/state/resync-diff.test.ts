// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { NodePort } from '@shumoku/core'
import { describe, expect, test } from 'vitest'
import { computeResyncPortDiff } from './resync-diff'

function port(overrides: Partial<NodePort>): NodePort {
  return {
    id: `id-${Math.random().toString(36).slice(2, 8)}`,
    label: '',
    connectors: [],
    ...overrides,
  } as NodePort
}

describe('computeResyncPortDiff', () => {
  test('empty current + empty template → no diff', () => {
    const r = computeResyncPortDiff([], [])
    expect(r).toEqual({ added: [], removed: [], changed: [] })
  })

  test('template port with no match in current goes to added', () => {
    const tpl = [port({ label: 'GE0', interfaceName: 'Gi0.0', speed: '1g' })]
    const r = computeResyncPortDiff([], tpl)
    expect(r.added).toHaveLength(1)
    expect(r.added[0]?.label).toBe('GE0')
    expect(r.removed).toHaveLength(0)
    expect(r.changed).toHaveLength(0)
  })

  test('current port with no match in template goes to removed', () => {
    const cur = [port({ label: 'old', interfaceName: 'GiX', speed: '1g' })]
    const r = computeResyncPortDiff(cur, [])
    expect(r.removed).toHaveLength(1)
    expect(r.removed[0]?.label).toBe('old')
  })

  test('matched ports with identical fields produce no diff', () => {
    const cur = [
      port({
        id: 'a',
        label: 'GE0',
        interfaceName: 'Gi0.0',
        speed: '1g',
        connectors: ['rj45'],
      }),
    ]
    const tpl = [
      port({
        id: 'b',
        label: 'GE0',
        interfaceName: 'Gi0.0',
        speed: '1g',
        connectors: ['rj45'],
      }),
    ]
    const r = computeResyncPortDiff(cur, tpl)
    expect(r.changed).toHaveLength(0)
    expect(r.added).toHaveLength(0)
    expect(r.removed).toHaveLength(0)
  })

  test('matched ports with differing physical fields land in changed', () => {
    const cur = [
      port({
        id: 'a',
        label: 'GE2',
        interfaceName: 'Gi2.0',
        speed: '1g',
        connectors: ['sfp'],
      }),
    ]
    const tpl = [
      port({
        id: 'b',
        label: 'GE2',
        interfaceName: 'Gi2.0',
        speed: '10g',
        connectors: ['rj45', 'sfp+'],
      }),
    ]
    const r = computeResyncPortDiff(cur, tpl)
    expect(r.changed).toHaveLength(1)
    const ch = r.changed[0]
    expect(ch?.identity).toBe('Gi2.0')
    const fields = ch?.diffs.map((d) => d.field).sort()
    expect(fields).toEqual(['connectors', 'speed'])
    const speedDiff = ch?.diffs.find((d) => d.field === 'speed')
    expect(speedDiff?.before).toBe('1g')
    expect(speedDiff?.after).toBe('10g')
  })

  test('matches by interfaceName even when labels differ', () => {
    const cur = [port({ id: 'a', label: 'CustomLabel', interfaceName: 'Gi1.0', speed: '1g' })]
    const tpl = [port({ id: 'b', label: 'GE1', interfaceName: 'Gi1.0', speed: '1g' })]
    const r = computeResyncPortDiff(cur, tpl)
    expect(r.added).toHaveLength(0)
    expect(r.removed).toHaveLength(0)
    expect(r.changed).toHaveLength(1)
    expect(r.changed[0]?.diffs.find((d) => d.field === 'label')?.before).toBe('CustomLabel')
    expect(r.changed[0]?.diffs.find((d) => d.field === 'label')?.after).toBe('GE1')
  })

  test('falls back to label match when interfaceName is absent on either side', () => {
    const cur = [port({ id: 'a', label: 'shared', speed: '1g' })]
    const tpl = [port({ id: 'b', label: 'shared', speed: '10g' })]
    const r = computeResyncPortDiff(cur, tpl)
    expect(r.changed).toHaveLength(1)
    expect(r.added).toHaveLength(0)
    expect(r.removed).toHaveLength(0)
  })

  test('does not match the same current port to two templates', () => {
    const cur = [port({ id: 'a', label: 'shared' })]
    const tpl = [port({ label: 'shared' }), port({ label: 'shared' })]
    const r = computeResyncPortDiff(cur, tpl)
    // First template claims the existing port (no field diff = no changed
    // entry); second template gets no match and lands in added.
    expect(r.added).toHaveLength(1)
    expect(r.removed).toHaveLength(0)
  })
})
