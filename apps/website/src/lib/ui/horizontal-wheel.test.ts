import { afterEach, describe, expect, it, vi } from 'vitest'
import { horizontalWheel, wheelDistance } from './horizontal-wheel'

afterEach(() => vi.unstubAllGlobals())

describe('horizontal wheel', () => {
  it('normalizes pixel, line and page deltas', () => {
    expect(wheelDistance(3, 0, 24, 300)).toBe(3)
    expect(wheelDistance(3, 1, 24, 300)).toBe(72)
    expect(wheelDistance(1, 2, 24, 300)).toBe(300)
  })

  function setup(position = 0) {
    let listener: (event: WheelEvent) => void = () => {}
    const element = {
      scrollWidth: 600,
      clientWidth: 300,
      scrollHeight: 40,
      clientHeight: 40,
      scrollLeft: position,
      scrollTo: vi.fn(),
      removeEventListener: vi.fn(),
      addEventListener: (_name: string, fn: typeof listener) => {
        listener = fn
      },
    }
    vi.stubGlobal('getComputedStyle', () => ({
      lineHeight: '24px',
      fontSize: '13px',
      direction: 'ltr',
    }))
    const cleanup = horizontalWheel(element as unknown as HTMLElement)
    const run = (options = {}) => {
      const event = {
        deltaX: 0,
        deltaY: 80,
        deltaMode: 0,
        cancelable: true,
        preventDefault: vi.fn(),
        ...options,
      }
      listener(event as unknown as WheelEvent)
      return event
    }
    return { element, run, cleanup }
  }

  it('consumes vertical wheel only when horizontal movement is possible', () => {
    const { element, run, cleanup } = setup()
    expect(run().preventDefault).toHaveBeenCalledOnce()
    expect(element.scrollTo).toHaveBeenCalledWith({ left: 80, behavior: 'instant' })
    if (typeof cleanup === 'function') cleanup()
    expect(element.removeEventListener).toHaveBeenCalledWith('wheel', expect.any(Function))
  })

  it('releases page scrolling at an edge', () => {
    const { element, run } = setup(300)
    expect(run().preventDefault).not.toHaveBeenCalled()
    expect(element.scrollTo).not.toHaveBeenCalled()
  })

  it('preserves trackpad horizontal gestures, zoom and shift wheel', () => {
    const { element, run } = setup()
    for (const options of [
      { deltaX: 12 },
      { ctrlKey: true },
      { shiftKey: true },
      { metaKey: true },
    ]) {
      expect(run(options).preventDefault).not.toHaveBeenCalled()
    }
    expect(element.scrollTo).not.toHaveBeenCalled()
  })
})
