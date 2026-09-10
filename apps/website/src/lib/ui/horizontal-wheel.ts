import type { Attachment } from 'svelte/attachments'

export function wheelDistance(delta: number, mode: number, line: number, page: number) {
  return delta * (mode === 1 ? line : mode === 2 ? page : 1)
}

/** Vertical mouse wheel -> horizontal-only surface; native gestures stay native. */
export const horizontalWheel: Attachment<HTMLElement> = (element) => {
  const wheel = (event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || !event.cancelable) return
    if (!event.deltaY || event.deltaX !== 0) return
    if (element.scrollWidth <= element.clientWidth || element.scrollHeight > element.clientHeight)
      return
    const style = getComputedStyle(element)
    const line = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize)
    const delta = wheelDistance(event.deltaY, event.deltaMode, line, element.clientWidth)
    const max = element.scrollWidth - element.clientWidth
    const rtl = style.direction === 'rtl'
    const before = element.scrollLeft
    const target = Math.max(rtl ? -max : 0, Math.min(rtl ? 0 : max, before + delta))
    if (target === before) return
    element.scrollTo({ left: target, behavior: 'instant' })
    event.preventDefault()
  }
  element.addEventListener('wheel', wheel, { passive: false })
  return () => element.removeEventListener('wheel', wheel)
}
