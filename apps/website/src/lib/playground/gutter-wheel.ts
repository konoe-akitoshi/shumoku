import type { Attachment } from 'svelte/attachments'
import { wheelDistance } from '../ui/horizontal-wheel'

export function gutterWheel(
  editor: () => HTMLTextAreaElement | undefined,
): Attachment<HTMLElement> {
  return (gutter) => {
    const wheel = (event: WheelEvent) => {
      const target = editor()
      if (!target || event.ctrlKey || event.metaKey || !event.cancelable) return
      const style = getComputedStyle(target)
      const line = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize)
      const x = wheelDistance(
        event.deltaX || (event.shiftKey ? event.deltaY : 0),
        event.deltaMode,
        line,
        target.clientWidth,
      )
      const y = wheelDistance(
        event.shiftKey ? 0 : event.deltaY,
        event.deltaMode,
        line,
        target.clientHeight,
      )
      const left = target.scrollLeft
      const top = target.scrollTop
      target.scrollBy({ left: x, top: y, behavior: 'instant' })
      if (target.scrollLeft !== left || target.scrollTop !== top) event.preventDefault()
    }
    gutter.addEventListener('wheel', wheel, { passive: false })
    return () => gutter.removeEventListener('wheel', wheel)
  }
}
