import type { Attachment } from 'svelte/attachments'

/** Physical horizontal delta; does not depend on RTL scrollLeft conventions. */
export function revealDelta(start: number, end: number, left: number, right: number) {
  if (start >= left && end <= right) return 0
  // An oversized item already spanning the viewport cannot be fully revealed.
  if (start <= left && end >= right) return 0
  if (end - start > right - left) {
    return start > left ? start - left : end - right
  }
  return start < left ? start - left : end - right
}

/** Selection is reactive; browser scrolling remains confined to this element. */
export function revealHorizontal(
  selected: (container: HTMLElement) => HTMLElement | null,
): Attachment<HTMLElement> {
  return (container) => {
    $effect(() => {
      const item = selected(container)
      if (!item) return
      const reveal = () => {
        const viewport = container.getBoundingClientRect()
        const bounds = item.getBoundingClientRect()
        const left = viewport.left + container.clientLeft
        const delta = revealDelta(bounds.left, bounds.right, left, left + container.clientWidth)
        if (delta) container.scrollBy({ left: delta, behavior: 'instant' })
      }
      reveal()
      // Watch preceding siblings too: font/label changes can move the selection.
      const observer = new ResizeObserver(reveal)
      observer.observe(container)
      for (const child of container.children) observer.observe(child)
      return () => observer.disconnect()
    })
  }
}
