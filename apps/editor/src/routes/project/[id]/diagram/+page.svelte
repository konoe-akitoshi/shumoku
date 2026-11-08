<script lang="ts">
  import { type Node, type NodeShape, type NodeSpec, newId, type Subgraph } from '@shumoku/core'
  import { attachCamera, type Box, drawNetworkScene, type Scene } from '@shumoku/renderer'
  import ShumokuRenderer from '@shumoku/renderer/components/ShumokuRenderer.svelte'
  import { renderNetworkSvg } from '@shumoku/renderer-svg'
  import { SvelteSet } from 'svelte/reactivity'
  import { clearActionContext, provideActionContext } from '$lib/actions/context-provider.svelte'
  import type { ActionContext, CameraHandle, RendererHandle } from '$lib/actions/types'
  import CanvasContextMenu from '$lib/components/CanvasContextMenu.svelte'
  import CodePanel from '$lib/components/CodePanel.svelte'
  import DetailPanel from '$lib/components/DetailPanel.svelte'
  import ExportMenu from '$lib/components/ExportMenu.svelte'
  import HeaderBar from '$lib/components/HeaderBar.svelte'
  import LabelEditPopover from '$lib/components/LabelEditPopover.svelte'
  import SideToolbar from '$lib/components/SideToolbar.svelte'
  import StatusBadge from '$lib/components/StatusBadge.svelte'
  import ViewBar from '$lib/components/view-bar/ViewBar.svelte'
  import { diagramState, editorState } from '$lib/context.svelte'
  import { clipboard } from '$lib/state/clipboard.svelte'
  import { detailPanel } from '$lib/state/detail-panel.svelte'
  import { readDrop } from '$lib/state/order-hints'
  import { preventBrowserZoom } from '$lib/utils/prevent-browser-zoom'

  preventBrowserZoom()

  // =========================================================================
  // Local UI state (page-specific, not shared)
  // =========================================================================

  let renderer: ShumokuRenderer | undefined = $state()
  let rendererSvg: SVGSVGElement | null = $state(null)

  // Camera handle for the action registry — diagram's d3-zoom doesn't
  // expose `fitAll`/`zoomIn`/`zoomOut` directly, so wrap its primitives.
  let cameraHandle = $state<CameraHandle | null>(null)

  // Editor camera: auto-detects mouse (wheel → zoom) vs trackpad
  // (two-finger → pan). Pinch always zooms. Alt+left or middle-click
  // drags the viewport.
  $effect(() => {
    if (!rendererSvg) return
    const c = attachCamera(rendererSvg)
    cameraHandle = {
      // `reset()` returns to the SVG viewBox (= layout bounds), which
      // is exactly "fit everything" since the renderer sizes the
      // viewBox to the computed graph extent.
      fitAll: () => c.reset(),
      zoomIn: () => c.zoomBy(1.25),
      zoomOut: () => c.zoomBy(0.8),
      reset: () => c.reset(),
    }
    return () => {
      c.detach()
      cameraHandle = null
    }
  })

  // The drawing of the diagram: the model as it stands now, drawn by the engine. Drawn after a
  // short pause so a run of edits draws once; sheets removed in the engine swap, the whole
  // network is drawn on one page.
  let scene = $state.raw<Scene | undefined>(undefined)
  $effect(() => {
    if (diagramState.status === 'Loading...') return
    const model = diagramState.currentModel()
    const hints = diagramState.drawHints
    const timer = setTimeout(() => {
      try {
        scene = drawNetworkScene(model, { hints })
      } catch (err) {
        console.error('[diagram] drawing failed:', err)
      }
    }, 30)
    return () => clearTimeout(timer)
  })

  // The diagram route never holds a scene; if a scene was active from a previous /scene
  // navigation, clear it.
  $effect(() => {
    if (diagramState.currentSceneId !== null) {
      diagramState.setCurrentScene(null)
    }
  })
  // Multi-selection state.
  //
  // `selectionIds` is the page-owned source of truth, two-way bound
  // into the renderer (which used to own it internally). Keeping it
  // on the page means the set survives any remount of
  // <ShumokuRenderer> — sheet switches, mount-gate flips, dev-server
  // HMR — so the user doesn't lose their working selection across
  // an invisible reactive blip. SvelteSet so in-place mutations
  // from any future caller stay reactive; today the renderer always
  // reassigns with a fresh SvelteSet.
  //
  // `selection` (typed) is `$derived` from `selectionIds` plus the
  // the scene — single source of truth, no callback mirror to drift out of sync. The classifier
  // mirrors the renderer's: edges > ports > subgraphs > nodes (default).
  type SelType = ActionContext['selection']['types'][number]
  let selectionIds = $state<SvelteSet<string>>(new SvelteSet())
  function classifyId(id: string): SelType {
    if (scene?.wires.some((w) => w.link.id === id)) return 'edge'
    if (scene?.ports?.some((p) => p.id === id)) return 'port'
    if (scene?.groups.some((g) => g.group.id === id)) return 'subgraph'
    return 'node'
  }
  const selection = $derived.by<{ ids: string[]; types: SelType[] }>(() => {
    const ids = [...selectionIds]
    return { ids, types: ids.map(classifyId) }
  })
  const selected = $derived<{ id: string; type: string } | null>(
    selection.ids[0] && selection.types[0]
      ? { id: selection.ids[0], type: selection.types[0] }
      : null,
  )

  // Adapter that lets registry-side actions (copy / paste) talk to
  // the renderer instance without each action grabbing the bound
  // ref themselves.
  const rendererHandle = $derived<RendererHandle | undefined>(
    renderer && rendererSvg
      ? {
          getElementInfo: (id: string) => renderer?.getElementInfo(id) ?? null,
          screenToSvg: (x: number, y: number) => renderer?.screenToSvg(x, y),
          addNewNode: (init) => addNode(init),
          addNewSubgraph: (init) => addGroup(init),
          viewportCenter: () => {
            if (!rendererSvg) return undefined
            const r = rendererSvg.getBoundingClientRect()
            return renderer?.screenToSvg(r.left + r.width / 2, r.top + r.height / 2)
          },
        }
      : undefined,
  )

  const actionCtx = $derived<ActionContext>({
    mode: 'diagram',
    selection,
    // canvasPos is filled in by `CanvasContextMenu` from the live
    // contextmenu event, since shadcn ContextMenu handles its own
    // positioning. The page-level ctx is just the rest of the state.
    camera: cameraHandle ?? undefined,
    renderer: rendererHandle,
  })

  // Publish to the global slot so the keyboard handler + any
  // toolbar buttons see this page's context. Re-runs on every
  // ctx change because of the $derived read.
  $effect(() => {
    provideActionContext(actionCtx)
    return clearActionContext
  })
  // =========================================================================
  // Adding elements. The engine places them: a new node or group goes into the selected group,
  // and the diagram is drawn again.
  // =========================================================================

  const ACCENT_TOKENS = [
    'accent-blue',
    'accent-green',
    'accent-red',
    'accent-amber',
    'accent-purple',
  ] as const

  /** The group the new element goes into: the selected one, if any. */
  function selectedGroup(): string | undefined {
    return [...selectionIds].find((id) => diagramState.subgraphs.has(id))
  }

  /** An accent not used by a sibling group, so adjacent groups differ in colour. */
  function pickAccentToken(parent?: string): string {
    const used = new Set<string>()
    for (const sg of diagramState.subgraphs.values()) {
      if (sg.parent === parent && sg.style?.fill) used.add(sg.style.fill)
    }
    const fresh = ACCENT_TOKENS.filter((t) => !used.has(t))
    const pool = fresh.length > 0 ? fresh : ACCENT_TOKENS
    return pool[Math.floor(Math.random() * pool.length)] ?? ACCENT_TOKENS[0]
  }

  function addNode(init: { id: string; label?: string; shape?: NodeShape; spec?: NodeSpec }) {
    const node: Node = {
      id: init.id,
      label: init.label ?? 'New Node',
      spec: init.spec,
      shape: init.shape ?? 'rounded',
      parent: selectedGroup(),
    }
    diagramState.nodes.set(node.id, node)
    selectionIds = new SvelteSet([node.id])
  }

  function addGroup(init: { id: string; label?: string }) {
    const parent = selectedGroup()
    const group: Subgraph = {
      id: init.id,
      label: init.label ?? 'New Group',
      parent,
      style: { fill: pickAccentToken(parent) },
    }
    diagramState.subgraphs.set(group.id, group)
    selectionIds = new SvelteSet([group.id])
  }

  /** A node or group was dropped: its group and place among its siblings are read from where. */
  function handleDrop(drop: { id: string; type: 'node' | 'subgraph'; box: Box }) {
    if (!scene) return
    diagramState.applyDrop(
      drop.id,
      drop.type,
      readDrop(scene, diagramState.model.drawing?.order, drop),
    )
  }

  let labelEdit = $state<{ portId: string; label: string; x: number; y: number } | null>(null)

  /** A scene port's id is `node/port`; the diagram's own ports are keyed `node:port`. */
  function diagramPortId(sceneId: string): string {
    const port = scene?.ports?.find((p) => p.id === sceneId)
    return port ? `${port.nodeId}:${sceneId.slice(port.nodeId.length + 1)}` : sceneId
  }
  let codePanelOpen = $state(false)

  // =========================================================================
  // Detail panel — resolve edge/port to their parent types
  // =========================================================================

  function openDetail(id: string, rawType: string) {
    if (rawType === 'node') {
      detailPanel.show({ id, type: 'node' })
    } else if (rawType === 'edge') {
      // Edge → find corresponding Link
      detailPanel.show({ id, type: 'link' })
    } else if (rawType === 'port') {
      // Port → open parent Node
      const port = scene?.ports?.find((p) => p.id === id)
      if (port) {
        detailPanel.show({ id: port.nodeId, type: 'node' })
      }
    } else if (rawType === 'subgraph') {
      detailPanel.show({ id, type: 'subgraph' })
    }
  }

  // =========================================================================
  // Export
  // =========================================================================

  function downloadFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleExportJson() {
    downloadFile(
      JSON.stringify(diagramState.exportModel(), null, 2),
      'diagram.json',
      'application/json',
    )
  }

  async function handleExportSvg() {
    const svg = await renderNetworkSvg(diagramState.currentModel())
    downloadFile(svg, 'diagram.svg', 'image/svg+xml')
  }
</script>

<div class="relative h-screen w-screen overflow-hidden bg-neutral-50 dark:bg-neutral-950">
  <!-- Canvas (full screen, z-0). `data-print-canvas` marks this as
       the surface that survives Print; everything outside it is
       hidden by `@media print` in app.css. The ContextMenu wraps the
       canvas: per-element right-clicks set `selected` via the
       renderer's `oncontextmenu` callback (no longer stopPropagation
       so it bubbles), and shadcn handles menu positioning. -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <CanvasContextMenu ctx={actionCtx}>
    <div
      data-print-canvas
      class="absolute inset-0"
      ondblclick={() => {
        if (selected) openDetail(selected.id, selected.type)
      }}
    >
      <!-- Mount the renderer for any non-loading status, regardless of
           node count. The legacy `nodes.size > 0 || status !== 'Loading...'`
           gate also rendered an empty project once loaded, but the OR with
           `size > 0` was a footgun: any update path that briefly flashed
           the map empty (replaceMap, mid-flight reroutes) would tear the
           renderer down and lose its instance state — selection, hover,
           drag — between two reactive frames. `replaceMap` is now
           diff-apply so it can no longer cause that, but the gate stays
           gated only on status so a future regression in the update path
           can't reintroduce the same class of bug. -->
      {#if diagramState.status !== 'Loading...'}
        <ShumokuRenderer
          bind:this={renderer}
          bind:svgElement={rendererSvg}
          preventContextMenuDefault={false}
          {scene}
          bind:selection={selectionIds}
          ondrop={handleDrop}
          theme={editorState.theme}
          mode={editorState.mode}
          hideNode={(n) => !!n.termination}
          onlabeledit={(portId: string, label: string, screenX: number, screenY: number) => {
            labelEdit = { portId: diagramPortId(portId), label, x: screenX, y: screenY }
          }}
        />
      {:else}
        <div class="flex items-center justify-center h-full text-neutral-400 dark:text-neutral-500">
          {diagramState.status}
        </div>
      {/if}
    </div>
  </CanvasContextMenu>

  <!-- Top-left: Undo / Redo header bar -->
  <div data-print-hide class="fixed top-3 left-3 z-20"><HeaderBar /></div>

  <!-- Top-right: Export. The menu itself stays in the DOM during
       print (its dropdown is closed and its trigger button hidden),
       but the ⌘+P binding inside it is still active. -->
  <div data-print-hide class="fixed top-3 right-3 z-20">
    <ExportMenu onexportjson={handleExportJson} onexportsvg={handleExportSvg} />
  </div>

  <!-- Right: diagram-side tools. -->
  <div data-print-hide class="fixed right-3 top-1/2 -translate-y-1/2 z-20">
    <SideToolbar
      mode={editorState.mode}
      isDark={editorState.isDark}
      onmodechange={(m) => {
        editorState.mode = m
      }}
      onaddnode={(spec) => addNode({ id: newId('node'), ...(spec ? { spec } : {}) })}
      onaddsubgraph={() => addGroup({ id: newId('sg') })}
      onthemetoggle={() => editorState.toggleTheme()}
    />
  </div>

  <!-- Bottom-left: Status -->
  <div data-print-hide class="fixed bottom-3 left-3 z-20">
    <StatusBadge
      status={diagramState.status}
      stats={diagramState.stats}
      {selected}
      selectionCount={selection.ids.length}
    />
  </div>

  <!-- Left side: Code panel (slide-out) -->
  <div data-print-hide class="fixed left-3 top-1/2 -translate-y-1/2 z-20 h-[80vh] flex">
    <CodePanel bind:isOpen={codePanelOpen} />
  </div>

  <!-- Bottom-center: segmented Diagram | Scene view picker. -->
  <div data-print-hide class="fixed bottom-3 left-1/2 -translate-x-1/2 z-20"><ViewBar /></div>

  <!-- Overlays -->

  {#if labelEdit}
    <LabelEditPopover
      portId={labelEdit.portId}
      label={labelEdit.label}
      x={labelEdit.x}
      y={labelEdit.y}
      oncommit={(portId, value) => {
        diagramState.updatePortLabel(portId, value)
      }}
      onclose={() => {
        labelEdit = null
      }}
    />
  {/if}

  <DetailPanel
    open={detailPanel.open}
    elementType={detailPanel.target?.type ?? null}
    elementId={detailPanel.target?.id ?? null}
    onclose={() => detailPanel.close()}
  />
</div>
