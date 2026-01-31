/**
 * Shared highlight utilities for topology SVG containers.
 * Operates on DOM elements with data-id and data-device-type attributes
 * produced by @shumoku/renderer.
 */

export interface HighlightOptions {
  /** Dim non-highlighted nodes (spotlight effect) */
  spotlight?: boolean
}

/**
 * Highlight specific nodes by their IDs.
 * Adds `.node-highlighted` to matched nodes and optionally `.node-dimmed` to others.
 */
export function highlightNodes(
  container: Element,
  nodeIds: string[],
  options?: HighlightOptions,
): void {
  clearHighlight(container)

  const idSet = new Set(nodeIds)
  const allNodes = container.querySelectorAll('.node[data-id]')

  for (const node of allNodes) {
    const id = node.getAttribute('data-id')
    if (id && idSet.has(id)) {
      node.classList.add('node-highlighted')
    } else if (options?.spotlight) {
      node.classList.add('node-dimmed')
    }
  }

  // Also dim links when spotlight is on
  if (options?.spotlight) {
    const allLinks = container.querySelectorAll('.link[data-id]')
    for (const link of allLinks) {
      link.classList.add('node-dimmed')
    }
  }
}

/**
 * Highlight nodes matching a data attribute value.
 * e.g. highlightByAttribute(container, 'data-device-type', 'l2-switch')
 */
export function highlightByAttribute(
  container: Element,
  key: string,
  value: string,
  options?: HighlightOptions,
): void {
  clearHighlight(container)

  const allNodes = container.querySelectorAll('.node[data-id]')

  for (const node of allNodes) {
    if (node.getAttribute(key) === value) {
      node.classList.add('node-highlighted')
    } else if (options?.spotlight) {
      node.classList.add('node-dimmed')
    }
  }

  if (options?.spotlight) {
    const allLinks = container.querySelectorAll('.link[data-id]')
    for (const link of allLinks) {
      link.classList.add('node-dimmed')
    }
  }
}

/**
 * Remove all highlight/dim classes from the container.
 */
export function clearHighlight(container: Element): void {
  for (const el of container.querySelectorAll('.node-highlighted')) {
    el.classList.remove('node-highlighted')
  }
  for (const el of container.querySelectorAll('.node-dimmed')) {
    el.classList.remove('node-dimmed')
  }
}
