// Action registry behavior. Doesn't exercise the built-in
// actions (those touch editor state) — just the dispatcher.

import { afterEach, expect, test } from 'vitest'
import {
  _resetRegistry,
  defineAction,
  runAction,
  visibleActions,
  visibleActionsByGroup,
} from './registry'
import type { ActionContext } from './types'

const baseCtx: ActionContext = {
  mode: 'diagram',
  selection: { ids: [], types: [] },
}

afterEach(() => {
  _resetRegistry()
})

test('visibleActions filters by `when`', () => {
  defineAction({ id: 'a', label: 'A', run: () => {} })
  defineAction({ id: 'b', label: 'B', when: (c) => c.mode === 'scene', run: () => {} })
  defineAction({ id: 'c', label: 'C', when: () => false, run: () => {} })

  const visible = visibleActions(baseCtx).map((a) => a.id)
  expect(visible).toEqual(['a'])
})

test('visibleActionsByGroup buckets by group', () => {
  defineAction({ id: 'e1', label: 'edit-1', group: 'edit', run: () => {} })
  defineAction({ id: 'v1', label: 'view-1', group: 'view', run: () => {} })
  defineAction({ id: 'e2', label: 'edit-2', group: 'edit', run: () => {} })
  defineAction({ id: 'm1', label: 'misc-1', run: () => {} })

  const groups = visibleActionsByGroup(baseCtx)
  // Insertion order is preserved across groups.
  expect(groups.map(([g]) => g)).toEqual(['edit', 'view', 'misc'])
  expect(groups[0]?.[1].map((a) => a.id)).toEqual(['e1', 'e2'])
})

test('runAction skips when `enabled` is false', async () => {
  let ran = false
  defineAction({
    id: 'gated',
    label: 'Gated',
    enabled: () => false,
    run: () => {
      ran = true
    },
  })
  const result = await runAction('gated', baseCtx)
  expect(result).toBe(false)
  expect(ran).toBe(false)
})

test('runAction returns false for unknown id', async () => {
  expect(await runAction('does.not.exist', baseCtx)).toBe(false)
})

test('runAction invokes run when allowed', async () => {
  let ran = false
  defineAction({
    id: 'fire',
    label: 'Fire',
    run: () => {
      ran = true
    },
  })
  expect(await runAction('fire', baseCtx)).toBe(true)
  expect(ran).toBe(true)
})
