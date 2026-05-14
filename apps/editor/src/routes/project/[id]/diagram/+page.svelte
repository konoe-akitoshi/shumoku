<script lang="ts">
  import { type LinkEndpoint, newId } from '@shumoku/core'
  import { attachCamera } from '@shumoku/renderer'
  import ShumokuRenderer from '@shumoku/renderer/components/ShumokuRenderer.svelte'
  import { renderGraphToSvg } from '@shumoku/renderer-svg'
  import { page } from '$app/stores'
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

  // Sync URL → state. `?focus=<id>` drives Hierarchy drilldown so a
  // reload restores the same view. The diagram route never holds a
  // scene; if a scene was active from a previous /scene navigation,
  // clear it.
  $effect(() => {
    const focus = $page.url.searchParams.get('focus')
    const focusId = focus || null
    if (diagramState.currentSheetId !== focusId) {
      diagramState.switchSheet(focusId)
    }
    if (diagramState.currentSceneId !== null) {
      diagramState.setCurrentScene(null)
    }
  })
  // Multi-selection state. The renderer drives this via
  // `onselectionchange`; the page just mirrors it so the action
  // registry / status bar / detail panel can react. `selected`
  // (singular) is a derived convenience for surfaces that only care
  // about the focused single item (StatusBadge, double-click detail).
  type SelType = ActionContext['selection']['types'][number]
  let selection = $state<{ ids: string[]; types: SelType[] }>({ ids: [], types: [] })
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
          addNewNode: (init) => renderer?.addNewNode(init),
          addNewSubgraph: (init) => renderer?.addNewSubgraph(init),
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
  let labelEdit = $state<{ portId: string; label: string; x: number; y: number } | null>(null)
  let codePanelOpen = $state(false)

  // =========================================================================
  // Detail panel — resolve edge/port to their parent types
  // =========================================================================

  function openDetail(id: string, rawType: string) {
    if (rawType === 'node') {
      detailPanel.show({ id, type: 'node' })
    } else if (rawType === 'edge') {
      // Edge → find corresponding Link
      const edge = diagramState.edges.get(id)
      if (edge?.link?.id) {
        detailPanel.show({ id: edge.link.id, type: 'link' })
      }
    } else if (rawType === 'port') {
      // Port → open parent Node
      const port = diagramState.ports.get(id)
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
    const graph = diagramState.exportGraph()
    downloadFile(JSON.stringify(graph, null, 2), 'diagram.json', 'application/json')
  }

  async function handleExportSvg() {
    const graph = diagramState.exportGraph()
    const svg = await renderGraphToSvg(graph)
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
          bind:nodes={diagramState.activeView.nodes}
          bind:ports={diagramState.activeView.ports}
          bind:edges={diagramState.activeView.edges}
          bind:subgraphs={diagramState.activeView.subgraphs}
          bind:bounds={diagramState.activeView.bounds}
          bind:links={diagramState.activeView.links}
          theme={editorState.theme}
          mode={diagramState.currentSheetId === null ? editorState.mode : 'view'}
          hideNode={(n) => !!n.termination}
          ondragstart={() => diagramState.beginTx('Move node')}
          ondragend={() => diagramState.endTx()}
          onselectionchange={(ids: string[], types: string[]) => {
            // Mirror the renderer's selection set so the action
            // registry / status bar see the live state. Fires
            // synchronously inside the renderer's click /
            // right-click handler, so the ContextMenu wrapper
            // sees the right selection when it opens.
            selection = { ids, types: types as SelType[] }
          }}
          onchange={() => {}}
          onlabeledit={(portId: string, label: string, screenX: number, screenY: number) => { labelEdit = { portId, label, x: screenX, y: screenY } }}
          onnodeadd={(_id: string) => {
            // The renderer mutated diagram.nodes directly (via $bindable)
            // before emitting this event — invalidate cached sheets now.
            diagramState.invalidateSheetCache()
          }}
          oncreatelink={(from: LinkEndpoint, to: LinkEndpoint) => {
            diagramState.addLink({ id: newId('link'), from, to })
          }}
          onportmove={(nodeId: string, portId: string, side: 'top' | 'bottom' | 'left' | 'right') => {
            diagramState.setPortPlacement(nodeId, portId, { side })
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
      onmodechange={(m) => { editorState.mode = m }}
      onaddnode={(spec) => renderer?.addNewNode({ id: newId('node'), ...(spec ? { spec } : {}) })}
      onaddsubgraph={() => renderer?.addNewSubgraph({ id: newId('sg') })}
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
        renderer?.commitLabel(portId, value)
      }}
      onclose={() => { labelEdit = null }}
    />
  {/if}

  <DetailPanel
    open={detailPanel.open}
    elementType={detailPanel.target?.type ?? null}
    elementId={detailPanel.target?.id ?? null}
    onclose={() => detailPanel.close()}
  />
</div>
