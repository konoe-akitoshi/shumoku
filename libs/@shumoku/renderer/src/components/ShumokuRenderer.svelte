<script lang="ts">
  import type {
    DeviceType,
    Link,
    LinkEndpoint,
    Node,
    NodeShape,
    NodeSpec,
    ResolvedEdge,
    ResolvedLayout,
    ResolvedPort,
    Subgraph,
    Theme,
  } from '@shumoku/core'
  import {
    addPort,
    collectObstacles,
    createEngine,
    detectClickSide,
    linkExists,
    moveNode,
    moveSubgraph,
    rebalanceSubgraphs,
    resolvePosition,
    routeEdges,
    specDeviceType,
  } from '@shumoku/core'

  /** Shared sizing engine for this renderer. */
  const engine = createEngine()
  const computeNodeBodySize = (n: { label?: string | string[]; spec?: NodeSpec }) =>
    engine.nodeBodySize(n as Parameters<typeof engine.nodeBodySize>[0])
  const resolveNodeSize = (n: {
    label?: string | string[]
    spec?: NodeSpec
    size?: { width: number; height: number }
  }) => n.size ?? computeNodeBodySize(n)

  import { SvelteMap, SvelteSet } from 'svelte/reactivity'
  import type { RendererOverlaySnippets } from '../lib/overlays'
  import { themeToColors } from '../lib/render-colors'
  import { screenToWorld as screenToWorldUtil } from '../lib/svg-coords'
  import SvgCanvas from './svg/SvgCanvas.svelte'

  /**
   * Renderer link endpoint — `port` is required because the renderer
   * never deals with portless connections (the model invariant).
   */
  export type RendererLinkEndpoint = LinkEndpoint

  /**
   * Replace the contents of a Map in place (used when core helpers return
   * fresh Maps but we want to keep our reactive SvelteMap identity).
   *
   * Diff-apply, NOT clear-then-set: clear() makes the map flash
   * to `size === 0`, and any host gated on `size > 0` (e.g. an
   * `{#if nodes.size > 0}` mount around <ShumokuRenderer>) sees
   * the empty state and tears the renderer down — taking the
   * local selection / drag state with it. Diffing keeps `size`
   * monotonic w.r.t. the real change set.
   */
  function replaceMap<K, V>(target: Map<K, V>, source: Iterable<[K, V]>) {
    const next = source instanceof Map ? source : new Map(source)
    for (const k of [...target.keys()]) {
      if (!next.has(k)) target.delete(k)
    }
    for (const [k, v] of next) target.set(k, v)
  }

  interface RendererProps extends RendererOverlaySnippets {
    // Direct state (preferred — parent owns state)
    nodes?: Map<string, Node>
    ports?: Map<string, ResolvedPort>
    edges?: Map<string, ResolvedEdge>
    subgraphs?: Map<string, Subgraph>
    bounds?: { x: number; y: number; width: number; height: number }
    links?: Link[]
    // Legacy: pass layout object (WebComponent compat)
    layout?: ResolvedLayout
    graph?: { links: Link[] }
    theme?: Theme
    mode?: 'view' | 'edit'
    /**
     * The rendered <svg> root. Bindable so host apps can reach into the
     * DOM for overlay effects (e.g. traffic-flow animation, imperative
     * highlight) without going through the WebComponent wrapper.
     */
    svgElement?: SVGSVGElement | null
    onchange?: (links: Link[]) => void
    /**
     * Single-selection callback. Fires whenever the selection changes,
     * with the first selected element's id/type (or null/null on clear).
     * Kept stable for backward-compat with consumers that only care
     * about a single item (e.g. server/web TopologyViewer). For the
     * full selection set use `onselectionchange`.
     */
    onselect?: (id: string | null, type: string | null) => void
    /**
     * Multi-selection callback. Fires whenever the selection set
     * changes, with parallel `ids` / `types` arrays (empty when cleared).
     * Hosts that support multi-select (editor) listen here; viewer-only
     * surfaces can ignore it.
     */
    onselectionchange?: (ids: string[], types: string[]) => void
    onlabeledit?: (portId: string, label: string, screenX: number, screenY: number) => void
    oncontextmenu?: (id: string, type: string, screenX: number, screenY: number) => void
    onnodeadd?: (id: string) => void
    /**
     * Fires once when the user starts dragging a node or subgraph.
     * Hosts open an undo / cache transaction here and close it in
     * `ondragend` so the in-flight 60Hz drag mutations collapse
     * into one undo step + one IDB write.
     */
    ondragstart?: (id: string) => void
    ondragend?: (id: string) => void
    /**
     * Predicate to skip rendering specific nodes — useful when the
     * host stores extra nodes the user shouldn't see in this view
     * (e.g. the editor hides scene-physical termination nodes from
     * the logical diagram view).
     */
    hideNode?: (node: Node) => boolean
    /**
     * Fired when the user drags between two ports to request a new link.
     * The parent owns link identity — it must create the link (with an ID of
     * its choosing) and either push it via `bind:links` or call `appendLink()`.
     */
    oncreatelink?: (from: LinkEndpoint, to: LinkEndpoint) => void
    /**
     * User dragged an existing (linked) port to a new location on the
     * same node. Renderer computes the target side from the drop
     * coords; the host stores it as the port's `placement.side` so
     * the next layout pass keeps it there. `order` is currently not
     * computed by the renderer — order-within-side is a follow-up.
     */
    onportmove?: (nodeId: string, portId: string, side: 'top' | 'bottom' | 'left' | 'right') => void
    /**
     * Per-element right-clicks call `preventDefault()` by default to
     * suppress the browser's native context menu. Set this to `false`
     * when the host wraps the renderer in its own contextmenu UI
     * (e.g. shadcn ContextMenu / bits-ui) — those libraries bail on
     * events whose default is already prevented, so they need the
     * event to reach them with `defaultPrevented=false` and handle
     * suppression themselves.
     */
    preventContextMenuDefault?: boolean
    /**
     * Selected element ids. Bindable so the host can own the
     * selection lifecycle independently of this renderer instance:
     * when the renderer unmounts and remounts (e.g. its `{#if}`
     * mount gate flips, or it's swapped between sheets), the
     * selection survives. When the host doesn't bind, a fresh
     * SvelteSet is created at instantiation and the renderer
     * behaves as the sole owner — same UX as before this prop
     * existed.
     *
     * Typed as `Set<string>` so non-Svelte consumers can pass a
     * plain Set, but the renderer's internal reassignments use
     * `SvelteSet` so in-place ops (`.add` / `.delete` from a host
     * that mutates rather than replaces) stay reactive. The
     * renderer itself never mutates in place — every change
     * produces a fresh SvelteSet and reassigns — so the bound
     * value seen by `$derived` downstream is a single atomic
     * snapshot per mutation.
     */
    selection?: Set<string>
  }

  let {
    nodes = $bindable(new SvelteMap()),
    ports = $bindable(new SvelteMap()),
    edges = $bindable(new SvelteMap()),
    subgraphs = $bindable(new SvelteMap()),
    bounds = $bindable({ x: 0, y: 0, width: 0, height: 0 }),
    links = $bindable([]),
    layout = undefined,
    graph = undefined,
    theme = undefined,
    mode = 'view',
    svgElement = $bindable<SVGSVGElement | null>(null),
    onchange,
    onselect,
    onselectionchange,
    onlabeledit,
    oncontextmenu: onctx,
    onnodeadd,
    ondragstart,
    ondragend,
    hideNode,
    oncreatelink,
    onportmove,
    subgraphOverlay,
    linkOverlay,
    nodeOverlay,
    portOverlay,
    preventContextMenuDefault = true,
    selection = $bindable<Set<string>>(new SvelteSet()),
  }: RendererProps = $props()

  const colors = $derived(themeToColors(theme))
  const interactive = $derived(mode === 'edit')

  // Legacy compat: sync from layout/graph props (WebComponent uses these)
  $effect(() => {
    if (layout) {
      replaceMap(nodes, layout.nodes)
      replaceMap(ports, layout.ports)
      replaceMap(edges, layout.edges)
      replaceMap(subgraphs, layout.subgraphs)
      bounds = layout.bounds
    }
  })
  $effect(() => {
    if (graph?.links) links = [...graph.links]
  })

  // =========================================================================
  // Edit state
  // =========================================================================

  // `selection` lives on the host via $bindable (declared in $props
  // above) so it survives renderer unmount / remount cycles. Other
  // instance state (linkDrag, hover) is intentionally local — those
  // are transient gestures that mean nothing across a remount.
  let linkDrag = $state<{
    fromPortId: string
    fromX: number
    fromY: number
    toX: number
    toY: number
  } | null>(null)

  const linkedPorts = $derived.by(() => {
    const ids = new Set<string>()
    for (const edge of edges.values()) {
      if (edge.fromPortId) ids.add(edge.fromPortId)
      if (edge.toPortId) ids.add(edge.toPortId)
    }
    return ids
  })

  // =========================================================================
  // Coordinate helpers
  // =========================================================================

  /**
   * Convert screen (clientX/Y) coordinates to world coords (post
   * camera transform). Exported so hosts that don't bind the renderer
   * directly can still translate pointer events into model space
   * (e.g. paste-at-cursor in the editor's action registry). Returns
   * the input untransformed when the renderer hasn't mounted yet.
   */
  export function screenToSvg(screenX: number, screenY: number): { x: number; y: number } {
    if (!svgElement) return { x: screenX, y: screenY }
    return screenToWorldUtil(svgElement, screenX, screenY)
  }

  // =========================================================================
  // Keyboard + selection notifications
  // =========================================================================

  $effect(() => {
    if (!svgElement) return
    const el = svgElement
    el.addEventListener('keydown', handleKeyDown)
    return () => el.removeEventListener('keydown', handleKeyDown)
  })

  function classifyId(id: string): 'node' | 'edge' | 'subgraph' | 'port' {
    if (edges.has(id)) return 'edge'
    if (ports.has(id)) return 'port'
    if (subgraphs.has(id)) return 'subgraph'
    return 'node'
  }

  /** Emit both callbacks in lockstep after a selection mutation.
   *  Called synchronously inside event handlers so consumers' state
   *  is up to date before the event finishes bubbling — important
   *  for context-menu wrappers that read selection on right-click. */
  function emitSelection() {
    const ids = [...selection]
    const types = ids.map(classifyId)
    onselectionchange?.(ids, types)
    onselect?.(ids[0] ?? null, types[0] ?? null)
  }

  // Drop selection entries whose target was removed from the model
  // (e.g. after multi-delete or undo). Without this, StatusBadge would
  // keep showing a stale "N selected" until the user clicks elsewhere.
  $effect(() => {
    let changed = false
    const next = new SvelteSet<string>()
    for (const id of selection) {
      if (nodes.has(id) || edges.has(id) || subgraphs.has(id) || ports.has(id)) {
        next.add(id)
      } else {
        changed = true
      }
    }
    if (changed) {
      selection = next
      emitSelection()
    }
  })

  function handleSelect(id: string, ev?: MouseEvent) {
    // Shift / Cmd (macOS) / Ctrl (Windows-Linux) → additive toggle.
    // Plain click → replace.
    const additive = !!ev && (ev.shiftKey || ev.metaKey || ev.ctrlKey)
    if (additive) {
      const next = new SvelteSet(selection)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      selection = next
    } else {
      selection = new SvelteSet([id])
    }
    emitSelection()
  }
  function handleBackgroundClick() {
    selection = new SvelteSet()
    emitSelection()
  }
  function handleContextMenu(id: string, type: string, e: MouseEvent) {
    // Right-click on an unselected item reduces the selection to that
    // single item; right-click on something already selected keeps the
    // existing multi-selection so the menu applies to the whole set.
    if (!selection.has(id)) {
      selection = new SvelteSet([id])
      emitSelection()
    }
    onctx?.(id, type, e.clientX, e.clientY)
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      selection = new SvelteSet()
      emitSelection()
      linkDrag = null
    } else if ((e.metaKey || e.ctrlKey) && (e.key === 'a' || e.key === 'A')) {
      // Cmd/Ctrl+A → select every node + subgraph. Edges and ports
      // intentionally excluded; they're rarely the target of bulk
      // operations and including them clutters Delete behavior.
      e.preventDefault()
      const next = new SvelteSet<string>()
      for (const id of nodes.keys()) next.add(id)
      for (const id of subgraphs.keys()) next.add(id)
      selection = next
      emitSelection()
    }
  }

  // =========================================================================
  // Drag (unified for nodes and subgraphs; supports multi-selection)
  // =========================================================================
  //
  // Multi-drag strategy: when the user starts dragging a node that's part
  // of a multi-selection, snapshot every selected element's origin at
  // dragstart. On every tick, compute how far the *dragged* element
  // actually moved (after its own collision resolution), then translate
  // the other selected elements by that delta. This keeps the group
  // visually rigid — drag two nodes apart, both move together; bump into
  // an obstacle, the entire group is held back by the dragged one.
  let multiDragOrigin: Map<string, { x: number; y: number }> | null = null

  function handleDragStart(id: string) {
    if (selection.has(id) && selection.size > 1) {
      multiDragOrigin = new Map()
      for (const sid of selection) {
        if (nodes.has(sid)) {
          const p = nodes.get(sid)?.position
          if (p) multiDragOrigin.set(sid, { x: p.x, y: p.y })
        } else if (subgraphs.has(sid)) {
          const b = subgraphs.get(sid)?.bounds
          if (b) multiDragOrigin.set(sid, { x: b.x, y: b.y })
        }
      }
    } else {
      multiDragOrigin = null
    }
    ondragstart?.(id)
  }

  function handleDragEnd(id: string) {
    multiDragOrigin = null
    ondragend?.(id)
  }

  async function handleDragMove(id: string, x: number, y: number) {
    const state = { nodes, ports, subgraphs }
    const result = nodes.has(id)
      ? await moveNode(id, x, y, state, links)
      : subgraphs.has(id)
        ? await moveSubgraph(id, x, y, state, links)
        : null
    if (!result) return
    replaceMap(nodes, result.nodes)
    replaceMap(ports, result.ports)
    replaceMap(edges, result.edges)
    if (result.subgraphs) replaceMap(subgraphs, result.subgraphs)

    if (!multiDragOrigin?.has(id)) return
    // Where the dragged element ended up after collision resolution.
    const draggedNow = nodes.get(id)?.position ?? subgraphs.get(id)?.bounds
    const origin = multiDragOrigin.get(id)
    if (!draggedNow || !origin) return
    const dx = draggedNow.x - origin.x
    const dy = draggedNow.y - origin.y
    for (const [sid, sorigin] of multiDragOrigin) {
      if (sid === id) continue
      const tx = sorigin.x + dx
      const ty = sorigin.y + dy
      const st = { nodes, ports, subgraphs }
      const r = nodes.has(sid)
        ? await moveNode(sid, tx, ty, st, links)
        : subgraphs.has(sid)
          ? await moveSubgraph(sid, tx, ty, st, links)
          : null
      if (!r) continue
      replaceMap(nodes, r.nodes)
      replaceMap(ports, r.ports)
      replaceMap(edges, r.edges)
      if (r.subgraphs) replaceMap(subgraphs, r.subgraphs)
    }
  }

  function handleMarquee(rect: { x: number; y: number; w: number; h: number }, additive: boolean) {
    const hits = new Set<string>()
    const rx1 = rect.x
    const ry1 = rect.y
    const rx2 = rect.x + rect.w
    const ry2 = rect.y + rect.h
    const intersects = (ex1: number, ey1: number, ex2: number, ey2: number) =>
      ex1 < rx2 && ex2 > rx1 && ey1 < ry2 && ey2 > ry1
    for (const [id, node] of nodes) {
      if (hideNode?.(node)) continue
      const p = node.position
      if (!p) continue
      const size = resolveNodeSize(node)
      const hw = size.width / 2
      const hh = size.height / 2
      if (intersects(p.x - hw, p.y - hh, p.x + hw, p.y + hh)) hits.add(id)
    }
    for (const [id, sg] of subgraphs) {
      const b = sg.bounds
      if (!b) continue
      if (intersects(b.x, b.y, b.x + b.width, b.y + b.height)) hits.add(id)
    }
    selection = additive ? new SvelteSet([...selection, ...hits]) : new SvelteSet(hits)
    emitSelection()
  }

  // =========================================================================
  // Add element (shared: parent detection → collision resolve → rebalance)
  // =========================================================================

  // Tokens defined in the theme surface palette (see themes/light.ts,
  // themes/dark.ts). Adding a new accent here will require adding it
  // to both theme files.
  const ACCENT_TOKENS = [
    'accent-blue',
    'accent-green',
    'accent-red',
    'accent-amber',
    'accent-purple',
  ] as const

  /**
   * Pick a random accent token, biased away from any accent already
   * used by an immediate-sibling subgraph so adjacent groups don't
   * end up the same color. Falls back to pure random when the
   * palette is exhausted.
   */
  function pickAccentToken(parent?: string): string {
    const used = new Set<string>()
    for (const [, sg] of subgraphs) {
      if (sg.parent !== parent) continue
      const fill = sg.style?.fill
      if (fill && (ACCENT_TOKENS as readonly string[]).includes(fill)) used.add(fill)
    }
    const fresh = ACCENT_TOKENS.filter((t) => !used.has(t))
    const pool = fresh.length > 0 ? fresh : ACCENT_TOKENS
    return pool[Math.floor(Math.random() * pool.length)] ?? ACCENT_TOKENS[0]
  }

  function resolveParentAndPosition(
    position: { x: number; y: number } | undefined,
    w: number,
  ): { parent: string | undefined; initial: { x: number; y: number } } {
    const selectedSgId = [...selection].find((sid) => subgraphs.has(sid))
    const parentSg = selectedSgId ? subgraphs.get(selectedSgId) : undefined
    if (parentSg) {
      return {
        parent: selectedSgId,
        initial: position ?? {
          x: (parentSg.bounds?.x ?? 0) + (parentSg.bounds?.width ?? 0) / 2,
          y: (parentSg.bounds?.y ?? 0) + (parentSg.bounds?.height ?? 0) / 2,
        },
      }
    }
    return {
      parent: undefined,
      initial: position ?? {
        x: bounds.x + bounds.width + 20 + w / 2,
        y: bounds.y + bounds.height / 2,
      },
    }
  }

  function finalizeAdd(id: string) {
    // rebalanceSubgraphs mutates the subgraphs map's entries in place; since
    // we now use a SvelteMap the mutations are picked up without any reassign.
    rebalanceSubgraphs(nodes, subgraphs, ports)
    selection = new SvelteSet([id])
    emitSelection()
  }

  export function addNewNode(opts: {
    id: string
    label?: string
    type?: DeviceType
    spec?: NodeSpec
    shape?: NodeShape
    position?: { x: number; y: number }
  }) {
    const { id } = opts
    const label = opts.label ?? 'New Node'
    const spec = opts.spec
      ? opts.spec
      : opts.type
        ? ({ kind: 'hardware' as const, type: opts.type } satisfies NodeSpec)
        : undefined
    const { width: w, height: h } = computeNodeBodySize({ label, spec })
    const { parent, initial } = resolveParentAndPosition(opts.position, w)
    const obstacles = collectObstacles(id, parent, nodes, subgraphs)
    const pos = resolvePosition({ x: initial.x, y: initial.y, w, h }, obstacles)

    nodes.set(id, {
      id,
      label,
      spec,
      shape: opts.shape ?? 'rounded',
      parent,
      position: pos,
    })
    finalizeAdd(id)
    onnodeadd?.(id)
    return id
  }

  export function addNewSubgraph(opts: {
    id: string
    label?: string
    position?: { x: number; y: number }
  }) {
    const { id } = opts
    const w = 200
    const h = 120
    const { parent, initial } = resolveParentAndPosition(opts.position, w)
    const obstacles = collectObstacles(id, parent, nodes, subgraphs)
    const pos = resolvePosition({ x: initial.x, y: initial.y, w, h }, obstacles)

    subgraphs.set(id, {
      id,
      label: opts.label ?? 'New Group',
      parent,
      bounds: { x: pos.x - w / 2, y: pos.y - h / 2, width: w, height: h },
      // Pick a random accent token so freshly placed groups are
      // visually distinct out of the box. Tokens resolve per theme
      // so light/dark modes pick up matching shades automatically.
      // User can override via the detail panel.
      style: { fill: pickAccentToken(parent) },
    })
    finalizeAdd(id)
    return id
  }

  // =========================================================================
  // Copy info (works for nodes and subgraphs)
  // =========================================================================

  export function getElementInfo(id: string) {
    const node = nodes.get(id)
    if (node) {
      return {
        kind: 'node' as const,
        label: node.label ?? 'Node',
        shape: node.shape,
        spec: node.spec,
        type: specDeviceType(node.spec),
      }
    }
    const sg = subgraphs.get(id)
    if (sg) {
      return { kind: 'subgraph' as const, label: sg.label ?? 'Group' }
    }
    return null
  }

  /** Get full details of any element for inspection/detail panel */
  // biome-ignore lint/suspicious/noExplicitAny: returns mixed element data
  export function getElementDetails(id: string): Record<string, any> | null {
    const node = nodes.get(id)
    if (node) {
      const nodePorts = [...ports.values()].filter((p) => p.nodeId === id)
      return {
        kind: 'node',
        ...node,
        size: resolveNodeSize(node),
        ports: nodePorts.map((p) => ({
          id: p.id,
          label: p.label,
          side: p.side,
          position: p.absolutePosition,
        })),
      }
    }
    const sg = subgraphs.get(id)
    if (sg) {
      const childNodes = [...nodes.values()].filter((n) => n.parent === id).length
      const childSgs = [...subgraphs.values()].filter((s) => s.parent === id).length
      return {
        kind: 'subgraph',
        ...sg,
        children: { nodes: childNodes, subgraphs: childSgs },
      }
    }
    const edge = edges.get(id)
    if (edge) {
      return {
        kind: 'edge',
        id: edge.id,
        from: edge.fromEndpoint,
        to: edge.toEndpoint,
        width: edge.width,
        points: edge.points.length,
        link: edge.link,
      }
    }
    const port = ports.get(id)
    if (port) {
      return {
        kind: 'port',
        id: port.id,
        label: port.label,
        nodeId: port.nodeId,
        side: port.side,
        position: port.absolutePosition,
        size: port.size,
      }
    }
    return null
  }

  // =========================================================================
  // Port operations
  // =========================================================================

  async function handleAddPort(nodeId: string, side: 'top' | 'bottom' | 'left' | 'right') {
    const result = addPort(nodeId, side, nodes, ports, links)
    if (!result) return
    replaceMap(nodes, result.nodes)
    replaceMap(ports, result.ports)
    replaceMap(edges, await routeEdges(result.nodes, result.ports, links, subgraphs))
  }

  export function commitLabel(portId: string, newLabel: string) {
    const port = ports.get(portId)
    if (!port || newLabel === port.label) return
    ports.set(portId, { ...port, label: newLabel })
  }

  // =========================================================================
  // Link operations
  // =========================================================================

  let linkCleanup: (() => void) | null = null

  function handleLinkStart(portId: string, _x: number, _y: number) {
    const port = ports.get(portId)
    if (!port) return
    linkDrag = {
      fromPortId: portId,
      fromX: port.absolutePosition.x,
      fromY: port.absolutePosition.y,
      toX: port.absolutePosition.x,
      toY: port.absolutePosition.y,
    }
    function onmove(e: PointerEvent) {
      if (!linkDrag) return
      const svgPt = screenToSvg(e.clientX, e.clientY)
      linkDrag = { ...linkDrag, toX: svgPt.x, toY: svgPt.y }
    }
    function onup(e: PointerEvent) {
      if ((e.target as Element).closest('.port')) return
      cleanup()
    }
    function cleanup() {
      svgElement?.removeEventListener('pointermove', onmove)
      svgElement?.removeEventListener('pointerup', onup)
      linkDrag = null
      linkCleanup = null
    }
    linkCleanup = cleanup
    svgElement?.addEventListener('pointermove', onmove)
    svgElement?.addEventListener('pointerup', onup)
  }

  function handleLinkEnd(portId: string) {
    if (!linkDrag) return
    const fromPortId = linkDrag.fromPortId
    linkCleanup?.()
    if (fromPortId === portId) return
    // Reject drops on an already-linked target. A port is one physical
    // termination — it can host at most one link. linkedPorts derives
    // from the live edges set so this is in sync with what the user sees.
    if (linkedPorts.has(portId)) return
    const fromPort = ports.get(fromPortId)
    const toPort = ports.get(portId)
    if (fromPort && toPort && fromPort.nodeId === toPort.nodeId) return
    doAddLink(fromPortId, portId)
  }

  function doAddLink(fromPortId: string, toPortId: string) {
    const fromParts = fromPortId.split(':')
    const toParts = toPortId.split(':')
    let fromNode = fromParts[0] ?? ''
    let fromPort = fromParts.slice(1).join(':')
    let toNode = toParts[0] ?? ''
    let toPort = toParts.slice(1).join(':')
    if (!fromNode || !fromPort || !toNode || !toPort) return
    if (linkExists(links, fromNode, fromPort, toNode, toPort)) return
    const fromNodeObj = nodes.get(fromNode)
    const toNodeObj = nodes.get(toNode)
    if (fromNodeObj && toNodeObj && (fromNodeObj.position?.y ?? 0) > (toNodeObj.position?.y ?? 0)) {
      ;[fromNode, toNode] = [toNode, fromNode]
      ;[fromPort, toPort] = [toPort, fromPort]
    }
    // Emit event — parent owns link identity and state mutation.
    oncreatelink?.({ node: fromNode, port: fromPort }, { node: toNode, port: toPort })
  }

  /**
   * Imperatively append a link (with caller-supplied id) to internal state.
   * Used by the WebComponent wrapper, which owns its link state internally.
   * Editor apps should prefer mutating their own state via `bind:links`.
   */
  /**
   * Translate screen coords to SVG coords, decide which edge of the
   * port's node the drop landed nearest to, and tell the host to
   * persist the placement. If the side didn't actually change we
   * skip the callback so the host's commit() doesn't dirty undo /
   * cache for a no-op.
   */
  function handlePortDragEnd(portId: string, screenX: number, screenY: number) {
    if (!onportmove) return
    const port = ports.get(portId)
    if (!port) return
    const node = nodes.get(port.nodeId)
    if (!node?.position) return
    const { x, y } = screenToSvg(screenX, screenY)
    const newSide = detectClickSide(
      x,
      y,
      node as typeof node & { position: { x: number; y: number } },
    )
    if (newSide === port.side) return
    // Bare port id used by external API — SvgPort sees the resolved
    // `nodeId:portId` form; strip the prefix back to the raw port id
    // that lives on `NodePort.id`.
    const rawPortId = portId.startsWith(`${port.nodeId}:`)
      ? portId.slice(port.nodeId.length + 1)
      : portId
    onportmove(port.nodeId, rawPortId, newSide)
  }

  export async function appendLink(link: Link) {
    if (linkExists(links, link.from.node, link.from.port, link.to.node, link.to.port)) return
    links = [...links, link]
    replaceMap(edges, await routeEdges(nodes, ports, links, subgraphs))
    onchange?.(links)
  }
</script>

<div style="width: 100%; height: 100%; outline: none;">
  <SvgCanvas
    {nodes}
    {ports}
    {edges}
    {subgraphs}
    {bounds}
    {colors}
    {theme}
    {interactive}
    {selection}
    {linkedPorts}
    {subgraphOverlay}
    {linkOverlay}
    {nodeOverlay}
    {portOverlay}
    linkPreview={linkDrag}
    bind:svgEl={svgElement}
    ondragstart={handleDragStart}
    ondragmove={handleDragMove}
    ondragend={handleDragEnd}
    {hideNode}
    onselect={handleSelect}
    onaddport={handleAddPort}
    onlinkstart={handleLinkStart}
    onlinkend={handleLinkEnd}
    onportdragend={handlePortDragEnd}
    {onlabeledit}
    oncontextmenu={handleContextMenu}
    onbackgroundclick={handleBackgroundClick}
    onmarquee={handleMarquee}
    {preventContextMenuDefault}
  />
</div>
