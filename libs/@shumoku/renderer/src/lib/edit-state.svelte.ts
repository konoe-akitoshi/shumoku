/**
 * Reactive edit state for the interactive renderer.
 * Uses Svelte 5 $state runes for fine-grained reactivity.
 */

export type EntityType = 'node' | 'port' | 'edge'

export interface NodeDrag {
  nodeId: string
  /** SVG coords where drag started */
  startSvg: { x: number; y: number }
  /** Node position when drag started */
  startNode: { x: number; y: number }
}

export interface LinkDrag {
  fromPortId: string
  fromX: number
  fromY: number
  toX: number
  toY: number
}

export interface LabelEdit {
  portId: string
  value: string
  /** Screen-relative rect for positioning the input */
  screenRect: { top: number; left: number; width: number }
}

export interface ContextMenuState {
  /** Screen coords */
  x: number
  y: number
  targetId: string
  targetType: EntityType
}

export function createEditState() {
  let selection = $state(new Set<string>())
  let nodeDrag = $state<NodeDrag | null>(null)
  let linkDrag = $state<LinkDrag | null>(null)
  let labelEdit = $state<LabelEdit | null>(null)
  let contextMenu = $state<ContextMenuState | null>(null)
  let highlightedNodes = $state(new Set<string>())

  return {
    // Selection
    get selection() {
      return selection
    },
    select(id: string) {
      selection = new Set([id])
    },
    toggleSelect(id: string) {
      const next = new Set(selection)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      selection = next
    },
    clearSelection() {
      selection = new Set()
    },
    isSelected(id: string) {
      return selection.has(id)
    },

    // Node drag
    get nodeDrag() {
      return nodeDrag
    },
    startNodeDrag(nodeId: string, svgX: number, svgY: number, nodeX: number, nodeY: number) {
      nodeDrag = { nodeId, startSvg: { x: svgX, y: svgY }, startNode: { x: nodeX, y: nodeY } }
    },
    endNodeDrag() {
      nodeDrag = null
    },

    // Link drag
    get linkDrag() {
      return linkDrag
    },
    startLinkDrag(fromPortId: string, x: number, y: number) {
      linkDrag = { fromPortId, fromX: x, fromY: y, toX: x, toY: y }
    },
    updateLinkDrag(toX: number, toY: number) {
      if (!linkDrag) return
      linkDrag = { ...linkDrag, toX, toY }
    },
    endLinkDrag() {
      linkDrag = null
    },

    // Label edit
    get labelEdit() {
      return labelEdit
    },
    startLabelEdit(
      portId: string,
      value: string,
      rect: { top: number; left: number; width: number },
    ) {
      labelEdit = { portId, value, screenRect: rect }
    },
    updateLabelValue(value: string) {
      if (!labelEdit) return
      labelEdit = { ...labelEdit, value }
    },
    endLabelEdit() {
      labelEdit = null
    },

    // Context menu
    get contextMenu() {
      return contextMenu
    },
    showContextMenu(x: number, y: number, targetId: string, targetType: EntityType) {
      contextMenu = { x, y, targetId, targetType }
    },
    hideContextMenu() {
      contextMenu = null
    },

    // Node highlight (hover, port drag, etc.)
    get highlightedNodes() {
      return highlightedNodes
    },
    highlightNode(nodeId: string) {
      highlightedNodes = new Set([...highlightedNodes, nodeId])
    },
    unhighlightNode(nodeId: string) {
      const next = new Set(highlightedNodes)
      next.delete(nodeId)
      highlightedNodes = next
    },

    // Cancel any active operation
    cancelAll() {
      nodeDrag = null
      linkDrag = null
      labelEdit = null
      contextMenu = null
      highlightedNodes = new Set()
    },
  }
}

export type EditState = ReturnType<typeof createEditState>
