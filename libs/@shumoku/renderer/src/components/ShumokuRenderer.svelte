<script lang="ts">
  import { lightTheme, specDeviceType, type Theme } from '@shumoku/core'
  import { SvelteSet } from 'svelte/reactivity'
  import Diagram from '../kit/Diagram.svelte'
  import type { Scene } from '../kit/scene'
  import { resolveTokens } from '../kit/tokens'
  import type { RendererOverlaySnippets, ScenePort } from '../lib/overlays'
  import { screenToWorld } from '../lib/svg-coords'
  import LinkOverlayHost from './LinkOverlayHost.svelte'

  /**
   * The interactive viewer of a drawing scene. The picture is the kit's `Diagram`, the same
   * component the static output renders; this adds what a host needs around it: selection,
   * hover and context-menu events, a marquee in edit mode, overlays, and the `<svg>` to attach a
   * camera to. Elements are found by the kit's DOM contract: `.node[data-id]`, `.subgraph[data-id]`,
   * `.link-group[data-link-id]` and `.port[data-port]`.
   */
  interface RendererProps extends RendererOverlaySnippets {
    /** What `drawNetwork` made. Nothing is drawn while it is absent. */
    scene?: Scene
    theme?: Theme
    mode?: 'view' | 'edit'
    /**
     * The rendered <svg> root. Bindable so host apps can reach into the DOM for overlay effects
     * (traffic-flow animation, imperative highlight) and attach a camera.
     */
    svgElement?: SVGSVGElement | null
    /**
     * Single-selection callback. Fires whenever the selection changes, with the first selected
     * element's id/type (or null/null on clear). For the full set use `onselectionchange`.
     */
    onselect?: (id: string | null, type: string | null) => void
    /** Multi-selection callback: parallel `ids` / `types` arrays (empty when cleared). */
    onselectionchange?: (ids: string[], types: string[]) => void
    /** A port label asked to be edited (double click on a port in edit mode). */
    onlabeledit?: (portId: string, label: string, screenX: number, screenY: number) => void
    oncontextmenu?: (id: string, type: string, screenX: number, screenY: number) => void
    /** Predicate to skip drawing specific nodes (the editor hides scene-physical terminations). */
    hideNode?: (node: Scene['nodes'][number]['node']) => boolean
    /**
     * Per-element right-clicks call `preventDefault()` by default to suppress the browser's native
     * context menu. Set false when the host wraps the renderer in its own context menu.
     */
    preventContextMenuDefault?: boolean
    /** Selected element ids; bindable so the host owns the selection across remounts. */
    selection?: Set<string>
    /**
     * A node or group was dragged and dropped (edit mode). The renderer moves nothing itself:
     * the host decides what the drop means (an order among siblings, a different group) and
     * draws again. `box` is where the element's own box landed.
     */
    ondrop?: (drop: {
      id: string
      type: 'node' | 'subgraph'
      box: Scene['nodes'][number]['box']
    }) => void
  }

  let {
    scene = undefined,
    theme = lightTheme,
    mode = 'view',
    svgElement = $bindable<SVGSVGElement | null>(null),
    onselect,
    onselectionchange,
    onlabeledit,
    oncontextmenu: onctx,
    hideNode,
    preventContextMenuDefault = true,
    selection = $bindable<Set<string>>(new SvelteSet()),
    ondrop,
    subgraphOverlay,
    linkOverlay,
    nodeOverlay,
    portOverlay,
  }: RendererProps = $props()

  const interactive = $derived(mode === 'edit')
  const selectionColor = $derived(theme.colors.primary)
  const selectionLook = resolveTokens().selection

  /** The scene without the nodes the host hides, and the ports on them. */
  const shown = $derived.by(() => {
    if (!scene || !hideNode) return scene
    const hidden = new Set(scene.nodes.filter((n) => hideNode(n.node)).map((n) => n.node.id))
    if (hidden.size === 0) return scene
    return {
      ...scene,
      nodes: scene.nodes.filter((n) => !hidden.has(n.node.id)),
      ports: scene.ports?.filter((p) => !hidden.has(p.nodeId)),
    }
  })

  type ElementType = 'node' | 'edge' | 'subgraph' | 'port'

  const kinds = $derived.by(() => {
    const out = new Map<string, ElementType>()
    for (const g of shown?.groups ?? []) out.set(g.group.id, 'subgraph')
    for (const n of shown?.nodes ?? []) out.set(n.node.id, 'node')
    for (const w of shown?.wires ?? []) if (w.link.id !== undefined) out.set(w.link.id, 'edge')
    for (const p of shown?.ports ?? []) out.set(p.id, 'port')
    return out
  })

  // =========================================================================
  // Selection
  // =========================================================================

  const classifyId = (id: string): ElementType => kinds.get(id) ?? 'node'

  /** Emit both callbacks in lockstep, synchronously so context-menu wrappers see fresh state. */
  function emitSelection() {
    const ids = [...selection]
    const types = ids.map(classifyId)
    onselectionchange?.(ids, types)
    onselect?.(ids[0] ?? null, types[0] ?? null)
  }

  // Drop selection entries whose element left the scene (after a delete or an undo).
  $effect(() => {
    let changed = false
    const next = new SvelteSet<string>()
    for (const id of selection) {
      if (kinds.has(id)) next.add(id)
      else changed = true
    }
    if (changed) {
      selection = next
      emitSelection()
    }
  })

  // The `selected` class marks the selected elements; the kit's elements carry no selection state.
  $effect(() => {
    const svg = svgElement
    if (!svg) return
    void shown
    for (const el of svg.querySelectorAll('.selected')) el.classList.remove('selected')
    for (const id of selection) {
      const q = CSS.escape(id)
      for (const el of svg.querySelectorAll(
        `[data-id="${q}"], .link-group[data-link-id="${q}"], [data-port="${q}"]`,
      ))
        el.classList.add('selected')
    }
  })

  const ELEMENTS = '.port[data-port], .node[data-id], .link-group[data-link-id], .subgraph[data-id]'

  /** The element a pointer event landed on, by the kit's DOM contract. */
  function elementAt(target: EventTarget | null): { id: string; type: ElementType } | null {
    const el = target instanceof Element ? target.closest(ELEMENTS) : null
    if (!el) return null
    const port = el.getAttribute('data-port')
    if (port !== null) return { id: port, type: 'port' }
    const link = el.getAttribute('data-link-id')
    if (link !== null) return { id: link, type: 'edge' }
    const id = el.getAttribute('data-id')
    if (id === null) return null
    return { id, type: el.classList.contains('subgraph') ? 'subgraph' : 'node' }
  }

  function handleClick(e: MouseEvent) {
    if (suppressNextBackgroundClick) {
      suppressNextBackgroundClick = false
      return
    }
    const hit = elementAt(e.target)
    if (!hit) {
      selection = new SvelteSet()
      emitSelection()
      return
    }
    // Shift / Cmd / Ctrl add to the selection or take away from it; a plain click replaces it.
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      const next = new SvelteSet(selection)
      if (next.has(hit.id)) next.delete(hit.id)
      else next.add(hit.id)
      selection = next
    } else {
      selection = new SvelteSet([hit.id])
    }
    emitSelection()
  }

  function handleContextMenu(e: MouseEvent) {
    const hit = elementAt(e.target)
    if (!hit) return
    // Right-click on an unselected item reduces the selection to it; on a selected one keeps the
    // whole set so the menu applies to all of it.
    if (!selection.has(hit.id)) {
      selection = new SvelteSet([hit.id])
      emitSelection()
    }
    if (preventContextMenuDefault) e.preventDefault()
    onctx?.(hit.id, hit.type, e.clientX, e.clientY)
  }

  function handleDoubleClick(e: MouseEvent) {
    if (!interactive || !onlabeledit) return
    const hit = elementAt(e.target)
    if (hit?.type !== 'port') return
    const port = shown?.ports?.find((p) => p.id === hit.id)
    if (!port) return
    e.stopPropagation()
    onlabeledit(port.id, port.label ?? '', e.clientX, e.clientY)
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      selection = new SvelteSet()
      emitSelection()
    } else if ((e.metaKey || e.ctrlKey) && (e.key === 'a' || e.key === 'A')) {
      // Select every node and group; wires and ports are left out, they are rarely the target of
      // bulk operations and would clutter Delete.
      e.preventDefault()
      selection = new SvelteSet([
        ...(shown?.nodes ?? []).map((n) => n.node.id),
        ...(shown?.groups ?? []).map((g) => g.group.id),
      ])
      emitSelection()
    }
  }

  $effect(() => {
    const el = svgElement
    if (!el) return
    el.addEventListener('keydown', handleKeyDown)
    return () => el.removeEventListener('keydown', handleKeyDown)
  })

  // =========================================================================
  // Marquee (drag on empty canvas to box-select, edit mode)
  // =========================================================================
  // Alt+drag is the camera's pan, so it is skipped. Shift / Cmd / Ctrl at the start make the
  // marquee add to the selection.
  let marquee = $state<{ x0: number; y0: number; x1: number; y1: number; add: boolean } | null>(
    null,
  )
  // The click the browser makes after a marquee or a drag would change the selection.
  let suppressNextBackgroundClick = false

  // A node or group being dragged: it follows the pointer as a translation of its own element,
  // and the drop is reported once. Nothing about where it stands is kept.
  const DRAG_THRESHOLD = 4
  let drag: {
    id: string
    type: 'node' | 'subgraph'
    el: SVGElement
    box: Scene['nodes'][number]['box']
    startX: number
    startY: number
    clientX: number
    clientY: number
    dx: number
    dy: number
    moved: boolean
  } | null = null

  function startDrag(e: PointerEvent): boolean {
    if (!svgElement || !ondrop) return false
    const hit = elementAt(e.target)
    if (!hit || (hit.type !== 'node' && hit.type !== 'subgraph')) return false
    const box =
      hit.type === 'node'
        ? shown?.nodes.find((n) => n.node.id === hit.id)?.box
        : shown?.groups.find((g) => g.group.id === hit.id)?.box
    const el = e.target instanceof Element ? e.target.closest(ELEMENTS) : null
    if (!box || !(el instanceof SVGElement)) return false
    const p = screenToWorld(svgElement, e.clientX, e.clientY)
    drag = {
      id: hit.id,
      type: hit.type,
      el,
      box,
      startX: p.x,
      startY: p.y,
      clientX: e.clientX,
      clientY: e.clientY,
      dx: 0,
      dy: 0,
      moved: false,
    }
    svgElement.setPointerCapture(e.pointerId)
    return true
  }

  function handlePointerDown(e: PointerEvent) {
    if (!interactive || e.button !== 0 || e.altKey || !svgElement) return
    if (e.target !== svgElement) {
      startDrag(e)
      return
    }
    const p = screenToWorld(svgElement, e.clientX, e.clientY)
    marquee = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, add: e.shiftKey || e.metaKey || e.ctrlKey }
    svgElement.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: PointerEvent) {
    if (drag && svgElement) {
      if (
        !drag.moved &&
        Math.hypot(e.clientX - drag.clientX, e.clientY - drag.clientY) < DRAG_THRESHOLD
      )
        return
      const p = screenToWorld(svgElement, e.clientX, e.clientY)
      drag = { ...drag, moved: true, dx: p.x - drag.startX, dy: p.y - drag.startY }
      drag.el.style.transform = `translate(${drag.dx}px, ${drag.dy}px)`
      return
    }
    if (!marquee || !svgElement) return
    const p = screenToWorld(svgElement, e.clientX, e.clientY)
    marquee = { ...marquee, x1: p.x, y1: p.y }
  }

  function handlePointerUp() {
    if (drag) {
      const done = drag
      drag = null
      done.el.style.transform = ''
      if (done.moved) {
        suppressNextBackgroundClick = true
        ondrop?.({
          id: done.id,
          type: done.type,
          box: { ...done.box, x: done.box.x + done.dx, y: done.box.y + done.dy },
        })
      }
      return
    }
    if (!marquee) return
    const rect = {
      x: Math.min(marquee.x0, marquee.x1),
      y: Math.min(marquee.y0, marquee.y1),
      w: Math.abs(marquee.x1 - marquee.x0),
      h: Math.abs(marquee.y1 - marquee.y0),
    }
    const add = marquee.add
    marquee = null
    // A drag of a few units at most is a click on the background.
    if (rect.w <= 3 && rect.h <= 3) return
    const meets = (b: { x: number; y: number; width: number; height: number }) =>
      b.x < rect.x + rect.w &&
      b.x + b.width > rect.x &&
      b.y < rect.y + rect.h &&
      b.y + b.height > rect.y
    const hits = [
      ...(shown?.nodes ?? []).filter((n) => meets(n.box)).map((n) => n.node.id),
      ...(shown?.groups ?? []).filter((g) => meets(g.box)).map((g) => g.group.id),
    ]
    selection = new SvelteSet(add ? [...selection, ...hits] : hits)
    suppressNextBackgroundClick = true
    emitSelection()
  }

  // =========================================================================
  // Queries for hosts
  // =========================================================================

  /** Converts screen (clientX/Y) coordinates to the drawing's coordinates, camera included. */
  export function screenToSvg(screenX: number, screenY: number): { x: number; y: number } {
    if (!svgElement) return { x: screenX, y: screenY }
    return screenToWorld(svgElement, screenX, screenY)
  }

  /** What a node or group is, for hosts that copy it. */
  export function getElementInfo(id: string) {
    const node = scene?.nodes.find((n) => n.node.id === id)?.node
    if (node) {
      return {
        kind: 'node' as const,
        label: node.label ?? 'Node',
        shape: node.shape,
        spec: node.spec,
        type: specDeviceType(node.spec),
      }
    }
    const group = scene?.groups.find((g) => g.group.id === id)?.group
    if (group) return { kind: 'subgraph' as const, label: group.label ?? 'Group' }
    return null
  }

  // What the host's cursor and selection look like on the kit's elements.
  const hostStyles = $derived(`
    .node[data-id], .subgraph-bg, .port, .link-group path.link { cursor: pointer; }
    .subgraph-bg { pointer-events: fill; }
    .link-group path.link { pointer-events: stroke; }
    .marquee { fill: ${selectionColor}; fill-opacity: ${selectionLook.marqueeOpacity}; stroke: ${selectionColor}; stroke-width: ${selectionLook.marqueeWidth}; vector-effect: non-scaling-stroke; pointer-events: none; }
    .node.selected .node-bg > *, .subgraph.selected > .subgraph-bg, .port.selected .port-box {
      stroke: ${selectionColor}; stroke-width: ${selectionLook.width}; vector-effect: non-scaling-stroke;
    }
    .link-group.selected path.link { stroke: ${selectionColor}; }
    svg.camera-gesture .node[filter] { filter: none; }
    svg.camera-gesture .port-label, svg.camera-gesture .port-label-bg,
    svg.camera-gesture .port-label-text, svg.camera-gesture .link-caption,
    svg.camera-gesture .link-caption-leader { display: none; }
  `)
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
  style="width: 100%; height: 100%; outline: none;"
  onclick={handleClick}
  oncontextmenu={handleContextMenu}
  ondblclick={handleDoubleClick}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
>
  {#if shown}
    <Diagram
      scene={shown}
      {theme}
      fit
      styles={hostStyles}
      bind:svgElement
      groupOverlay={subgraphOverlay ? groupOverlaySnippet : undefined}
      wireOverlay={linkOverlay ? wireOverlaySnippet : undefined}
      nodeOverlay={nodeOverlay ? nodeOverlaySnippet : undefined}
      portOverlay={portOverlay ? portOverlaySnippet : undefined}
    >
      {#snippet top()}
        {#if marquee}
          <rect
            class="marquee"
            x={Math.min(marquee.x0, marquee.x1)}
            y={Math.min(marquee.y0, marquee.y1)}
            width={Math.abs(marquee.x1 - marquee.x0)}
            height={Math.abs(marquee.y1 - marquee.y0)}
          />
        {/if}
      {/snippet}
    </Diagram>
  {/if}
</div>

{#snippet groupOverlaySnippet(
    item: Scene['groups'][number],
  )}
  {@render subgraphOverlay?.(item.group, {
    selected: selection.has(item.group.id),
    interactive,
    bounds: item.box,
  })}
{/snippet}

{#snippet wireOverlaySnippet(
    wire: Scene['wires'][number],
  )}
  {#if linkOverlay}
    <LinkOverlayHost
      {svgElement}
      link={wire.link}
      points={wire.points}
      radii={wire.radii}
      stroke={wire.stroke}
      selected={wire.link.id !== undefined && selection.has(wire.link.id)}
      overlay={linkOverlay}
    />
  {/if}
{/snippet}

{#snippet nodeOverlaySnippet(
    item: Scene['nodes'][number],
  )}
  {@render nodeOverlay?.(item.node, {
    selected: selection.has(item.node.id),
    interactive,
    cx: item.box.x + item.box.width / 2,
    cy: item.box.y + item.box.height / 2,
    width: item.box.width,
    height: item.box.height,
  })}
{/snippet}

{#snippet portOverlaySnippet(
    port: ScenePort,
  )}
  {@render portOverlay?.(port, {
    selected: selection.has(port.id),
    interactive,
    px: port.at.x,
    py: port.at.y,
  })}
{/snippet}
