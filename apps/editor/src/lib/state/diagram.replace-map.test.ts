// Behavioural lock on `replaceMap`: it must reach the target shape
// WITHOUT passing through a transient empty state. A clear-then-set
// impl regresses the unmount-on-empty class of bugs (see PR #261 +
// the follow-on root fix) — anyone reactive on map size would tear
// down their state during the empty window.

import { expect, test } from 'vitest'
import { replaceMap } from './replace-map'

test('does not pass through size === 0 when growing or replacing non-empty', () => {
  const target = new Map<string, number>([
    ['a', 1],
    ['b', 2],
  ])
  const sizes: number[] = []
  // Patch set/delete to record size after each mutation. (Map doesn't
  // emit events; this is the closest we can observe without a
  // SvelteMap dep.)
  const origSet = target.set.bind(target)
  const origDelete = target.delete.bind(target)
  target.set = (k, v) => {
    const r = origSet(k, v)
    sizes.push(target.size)
    return r
  }
  target.delete = (k) => {
    const r = origDelete(k)
    sizes.push(target.size)
    return r
  }

  replaceMap(
    target,
    new Map([
      ['a', 10], // existing → update in place
      ['b', 20], // existing → update in place
      ['c', 30], // new
    ]),
  )

  expect([...target.entries()]).toEqual([
    ['a', 10],
    ['b', 20],
    ['c', 30],
  ])
  // No observation should have seen size 0.
  expect(sizes).not.toContain(0)
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(2)
})

test('removes entries no longer in source', () => {
  const target = new Map([
    ['a', 1],
    ['b', 2],
    ['c', 3],
  ])
  replaceMap(target, new Map([['b', 22]]))
  expect([...target.entries()]).toEqual([['b', 22]])
})

test('preserves insertion order for surviving keys', () => {
  // Map.set on an existing key keeps the original position. We rely
  // on this so keyed `{#each}` blocks don't churn when the diff is
  // just an in-place update.
  const target = new Map([
    ['a', 1],
    ['b', 2],
    ['c', 3],
  ])
  replaceMap(
    target,
    new Map([
      ['c', 33], // source-order changes, but...
      ['a', 11],
      ['b', 22],
    ]),
  )
  expect([...target.keys()]).toEqual(['a', 'b', 'c'])
})

test('appends genuinely new keys at the tail in source order', () => {
  const target = new Map([['a', 1]])
  replaceMap(
    target,
    new Map([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]),
  )
  expect([...target.keys()]).toEqual(['a', 'b', 'c'])
})

test('handles a truly empty source by emptying the target', () => {
  // The intentional "empty everything" case still works — only the
  // *transient* empty state is what we wanted to avoid.
  const target = new Map([['a', 1]])
  replaceMap(target, new Map())
  expect(target.size).toBe(0)
})

test('accepts iterables that are not Maps', () => {
  const target = new Map<string, number>()
  replaceMap(target, [
    ['a', 1],
    ['b', 2],
  ])
  expect([...target.entries()]).toEqual([
    ['a', 1],
    ['b', 2],
  ])
})
