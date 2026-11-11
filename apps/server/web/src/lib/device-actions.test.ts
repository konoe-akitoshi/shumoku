import { describe, expect, it } from 'vitest'
import {
  changeNotice,
  credentialBreakdown,
  effectNotice,
  impactOf,
  impactText,
  otherTopologies,
  removeMessage,
  selectionState,
  toggleIds,
  undoCalls,
  usageSummary,
  usageTotal,
  withoutTopology,
} from './device-actions'

const before = [
  { id: 'a', credentialId: 'p1', enabled: true },
  { id: 'b', credentialId: 'p1', enabled: true },
  { id: 'c', credentialId: undefined, enabled: false },
  { id: 'd', credentialId: 'p2', enabled: true },
]

describe('undoCalls', () => {
  it('restores each distinct previous credential in one call (null for none)', () => {
    const calls = undoCalls(before, ['a', 'b', 'c'], { credentialId: 'p9' })
    expect(calls).toEqual([
      { entityIds: ['a', 'b'], change: { credentialId: 'p1' } },
      { entityIds: ['c'], change: { credentialId: null } },
    ])
  })

  it('restores previous enabled flags', () => {
    const calls = undoCalls(before, ['a', 'c'], { enabled: false })
    expect(calls).toEqual([
      { entityIds: ['a'], change: { enabled: true } },
      { entityIds: ['c'], change: { enabled: false } },
    ])
  })
})

describe('changeNotice', () => {
  it('words each kind of edit and the skipped count', () => {
    expect(changeNotice({ credentialId: 'x' }, 3, 0, 'public')).toBe(
      '3 台に public を割り当てました',
    )
    expect(changeNotice({ credentialId: null }, 2, 1)).toBe(
      '2 台の割り当てを外しました（1 台はスキップ）',
    )
    expect(changeNotice({ enabled: false }, 4, 0)).toBe('4 台を対象外にしました')
    expect(changeNotice({ enabled: true }, 1, 0)).toBe('1 台の対象外を解除しました')
  })
})

describe('selection helpers', () => {
  it('reports none / some / all', () => {
    expect(selectionState(['a', 'b'], new Set())).toBe('none')
    expect(selectionState(['a', 'b'], new Set(['a']))).toBe('some')
    expect(selectionState(['a', 'b'], new Set(['a', 'b', 'z']))).toBe('all')
  })

  it('adds and removes ids without duplicates', () => {
    expect(toggleIds(['a'], ['a', 'b'], true)).toEqual(['a', 'b'])
    expect(toggleIds(['a', 'b', 'c'], ['a', 'b'], false)).toEqual(['c'])
  })
})

const usage = (ok: number, partial: number, failed: number, pending: number) => ({
  ok,
  partial,
  failed,
  pending,
})

describe('usageSummary', () => {
  it('counts devices, and warns about the ones that cannot be read', () => {
    expect(usageTotal(usage(5, 1, 2, 1))).toBe(9)
    expect(usageSummary(usage(5, 0, 0, 1))).toEqual({ text: '6 台', warn: false })
    expect(usageSummary(usage(5, 1, 2, 1))).toEqual({ text: '3/9 台が読めません', warn: true })
  })
})

describe('credentialBreakdown', () => {
  const creds = [
    { id: 'a', name: '本社' },
    { id: 'b', name: '倉庫' },
  ]

  it('is empty unless two or more credentials are involved', () => {
    expect(credentialBreakdown([{ credentialId: 'a' }, { credentialId: 'a' }], creds)).toEqual([])
  })

  it('lists each credential with its device count', () => {
    expect(
      credentialBreakdown(
        [{ credentialId: 'b' }, { credentialId: 'a' }, { credentialId: 'b' }, {}],
        creds,
      ),
    ).toEqual([
      { id: 'a', name: '本社', count: 1 },
      { id: 'b', name: '倉庫', count: 2 },
    ])
  })
})

describe('impact of an edit', () => {
  const linked = [
    { id: 't1', name: '本社', usage: usage(3, 1, 0, 1), silent: 2 },
    { id: 't2', name: '支社', usage: usage(1, 0, 1, 0), silent: 4 },
  ]

  it('sums devices in use and silent ones', () => {
    expect(impactOf(linked)).toEqual({ inUse: 7, silent: 6 })
    expect(impactText({ inUse: 7, silent: 6 })).toBe(
      '保存すると: この認証情報で読んでいる 7 台を新しい値で読みます。応答なしの 6 台が再試行の対象に戻ります。',
    )
  })

  it('separates the other topologies', () => {
    expect(otherTopologies(linked, 't1').map((t) => t.id)).toEqual(['t2'])
    expect(withoutTopology(linked, 't1')).toEqual(['t2'])
  })

  it('words the server effect', () => {
    expect(effectNotice([{ name: '本社', devices: 5, retrySilent: 2 }])).toBe(
      '保存しました（本社: 5 台に反映、応答なし 2 台を再試行の対象に戻しました）',
    )
    expect(effectNotice([])).toBe('保存しました')
  })
})

describe('removeMessage', () => {
  it('words leaving one topology and deleting', () => {
    expect(removeMessage(4, [{ name: '支社' }], 'here')).toBe(
      '4 台が未確認に戻り、次の読み取りで他の認証情報が試されます。支社 では引き続き使われます。',
    )
    expect(removeMessage(4, [], 'here')).toBe(
      '4 台が未確認に戻ります。この認証情報は削除され、元に戻せません。',
    )
    expect(removeMessage(9, [{ name: '支社' }], 'all')).toBe(
      '9 台が未確認に戻ります。この認証情報は削除され、元に戻せません。',
    )
  })
})
