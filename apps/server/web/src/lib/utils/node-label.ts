/**
 * Resolve a topology node to a human-readable label.
 *
 * Node labels can be a string, a string array (multi-line label), or
 * missing entirely. Callers that want a single-line summary should use
 * this helper instead of reading `node.label` directly — keeps the
 * "fall back to id" rule in one place.
 */

interface NodeLike {
  id: string
  label?: string | string[]
}

/** One-line display name for a node. Empty/missing labels fall back to id. */
export function nodeLabel(node: NodeLike | undefined | null): string {
  if (!node) return ''
  const raw = Array.isArray(node.label) ? node.label.join(' ') : node.label
  if (!raw || raw.length === 0) return node.id
  // Labels may carry renderer markup ("<b>edge-rt-01</b>" renders bold on the
  // canvas). Every caller of this helper is a PLAIN-TEXT context (lists,
  // dropdowns, name matching), so strip the tags here — the one place — rather
  // than leaking "<b>…</b>" into the UI.
  const text = raw
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > 0 ? text : node.id
}

/** Look up a node by id and return its label. Returns the id if not found. */
export function nodeLabelById(nodes: ReadonlyArray<NodeLike> | undefined, nodeId: string): string {
  if (!nodes) return nodeId
  const found = nodes.find((n) => n.id === nodeId)
  return found ? nodeLabel(found) : nodeId
}
