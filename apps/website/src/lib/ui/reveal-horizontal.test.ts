import { describe, expect, it } from 'vitest'
import { revealDelta } from './reveal-horizontal.svelte'

describe('container-local horizontal reveal', () => {
  it.each([
    [20, 80, 0],
    [-20, 30, -20],
    [80, 120, 20],
    [100, 150, 50],
    [-30, 130, 0],
    [20, 150, 20],
    [-50, 80, -20],
    [0, 100, 0],
  ])('reveals bounds %s..%s by %s', (start, end, delta) => {
    expect(revealDelta(start, end, 0, 100)).toBe(delta)
  })
  it('uses viewport coordinates rather than assuming the container starts at zero', () => {
    expect(revealDelta(280, 320, 200, 300)).toBe(20)
  })
})
