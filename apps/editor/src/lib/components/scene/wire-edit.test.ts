import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Bend } from '$lib/scene/wire-drag'

const state = vi.hoisted(() => ({
  links: [{ id: 'wire', bends: undefined as Bend[] | undefined }],
  inTx: false,
  beginTx: vi.fn(),
  endTx: vi.fn(),
  setLinkBends: vi.fn(),
}))
vi.mock('$lib/context.svelte', () => ({ diagramState: state }))

import { bendOnDrag } from './wire-edit'

let doc: EventTarget
let win: EventTarget
let cleanup: (() => void) | undefined
let undoEntries: number
let before: string
beforeEach(() => {
  vi.clearAllMocks()
  doc = new EventTarget()
  win = new EventTarget()
  vi.stubGlobal('document', doc)
  vi.stubGlobal('window', win)
  state.links = [{ id: 'wire', bends: undefined }]
  state.inTx = false
  undoEntries = 0
  state.beginTx.mockImplementation(() => {
    state.inTx = true
    before = JSON.stringify(state.links)
  })
  state.endTx.mockImplementation(() => {
    if (before !== JSON.stringify(state.links)) undoEntries++
    state.inTx = false
  })
  state.setLinkBends.mockImplementation((_id: string, bends: Bend[] | undefined) => {
    state.links = [{ id: 'wire', bends }]
  })
})
afterEach(() => {
  cleanup?.()
  cleanup = undefined
  vi.unstubAllGlobals()
})
function start(addBend = true) {
  cleanup = bendOnDrag({
    linkId: 'wire',
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
    startClient: { x: 50, y: 0 },
    toFlow: (x, y) => ({ x, y }),
    zoom: 1,
    pointerId: 1,
    addBend,
  })
}
function pointer(type: string, x: number, y: number, pointerId = 1) {
  doc.dispatchEvent(Object.assign(new Event(type), { clientX: x, clientY: y, pointerId }))
}
test('a click creates no route edits or undo entry', () => {
  start()
  pointer('pointermove', 50, 2)
  pointer('pointerup', 50, 2)
  expect(state.beginTx).not.toHaveBeenCalled()
  expect(state.links[0]?.bends).toBeUndefined()
})
test('creation and movement form one transaction, including the last pointer position', () => {
  start()
  pointer('pointermove', 50, 5)
  pointer('pointermove', 50, 10)
  pointer('pointerup', 50, 12)
  expect(state.links[0]?.bends?.[0]?.y).toBe(12)
  expect(state.beginTx).toHaveBeenCalledTimes(1)
  expect(state.endTx).toHaveBeenCalledTimes(1)
  expect(undoEntries).toBe(1)
})
for (const reason of ['Escape', 'pointercancel', 'blur', 'unmount']) {
  test(`${reason} restores the original route without an undo entry`, () => {
    start()
    pointer('pointermove', 50, 10)
    if (reason === 'Escape')
      doc.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Escape' }))
    else if (reason === 'pointercancel') pointer('pointercancel', 50, 10)
    else if (reason === 'blur') win.dispatchEvent(new Event('blur'))
    else cleanup?.()
    expect(state.links[0]?.bends).toBeUndefined()
    expect(undoEntries).toBe(0)
    expect(state.inTx).toBe(false)
    pointer('pointermove', 50, 20)
    expect(state.links[0]?.bends).toBeUndefined()
  })
}
test('ignores a different pointer and does not take over an existing transaction', () => {
  start()
  pointer('pointermove', 50, 10, 2)
  expect(state.beginTx).not.toHaveBeenCalled()
  state.inTx = true
  pointer('pointermove', 50, 10)
  expect(state.beginTx).not.toHaveBeenCalled()
  expect(state.endTx).not.toHaveBeenCalled()
})

test('dragging along a straight segment does not create redundant bends', () => {
  start(false)
  pointer('pointermove', 70, 0)
  pointer('pointerup', 70, 0)
  expect(state.beginTx).not.toHaveBeenCalled()
  expect(state.links[0]?.bends).toBeUndefined()
})
test('returning to the original route leaves no bends or undo entry', () => {
  start(false)
  pointer('pointermove', 50, 10)
  pointer('pointerup', 50, 0)
  expect(state.links[0]?.bends).toBeUndefined()
  expect(undoEntries).toBe(0)
})
