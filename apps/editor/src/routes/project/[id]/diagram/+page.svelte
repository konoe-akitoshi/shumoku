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
  let selected = $state<{ id: string; type: string } | null>(null)
  // Canvas right-click menu — registry-driven for both empty
  // canvas and per-element clicks. The renderer's per-element
  // `oncontextmenu` callback first sets `selected = { id, type }`
  // so action gating sees the clicked item; then the wrapper div's
  // `oncontextmenu` opens this menu (per-element handlers
  // stopPropagation so only one path fires).
  let canvasMenuOpen = $state(false)
  let canvasMenuX = $state(0)
  let canvasMenuY = $state(0)

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
    selection: selected
      ? {
          ids: [selected.id],
          types: [selected.type as ActionContext['selection']['types'][number]],
        }
      : { ids: [], types: [] },
    canvasPos: canvasMenuOpen ? { x: canvasMenuX, y: canvasMenuY } : undefined,
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
  <!-- Canvas (full screen, z-0) -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="absolute inset-0"
    ondblclick={() => {
      if (selected) openDetail(selected.id, selected.type)
    }}
    oncontextmenu={(e) => {
      // Per-element handlers stopPropagation, so this only fires on
      // the empty canvas. Open the action-registry-driven menu in
      // place of the browser default.
      e.preventDefault()
      canvasMenuX = e.clientX
      canvasMenuY = e.clientY
      canvasMenuOpen = true
    }}
  >
    {#if diagramState.nodes.size > 0 || diagramState.status !== 'Loading...'}
      <ShumokuRenderer
        bind:this={renderer}
        bind:svgElement={rendererSvg}
        bind:nodes={diagramState.activeView.nodes}
        bind:ports={diagramState.activeView.ports}
        bind:edges={diagramState.activeView.edges}
        bind:subgraphs={diagramState.activeView.subgraphs}
        bind:bounds={diagramState.activeView.bounds}
        bind:links={diagramState.activeView.links}
        theme={editorState.theme}
        mode={diagramState.currentSheetId === null ? editorState.mode : 'view'}
        ondragstart={() => diagramState.beginTx('Move node')}
        ondragend={() => diagramState.endTx()}
        onselect={(id: string | null, type: string | null) => { selected = id ? { id, type: type ?? 'node' } : null }}
        onchange={() => {}}
        onlabeledit={(portId: string, label: string, screenX: number, screenY: number) => { labelEdit = { portId, label, x: screenX, y: screenY } }}
        oncontextmenu={(id: string, type: string, screenX: number, screenY: number) => {
          // Right-click selects the element so the registry-driven
          // menu sees it as the current selection, then opens the
          // canvas-level menu at the click position. Same component
          // as empty-canvas right-click — one menu, two trigger paths.
          selected = { id, type }
          canvasMenuX = screenX
          canvasMenuY = screenY
          canvasMenuOpen = true
        }}
        onnodeadd={(_id: string) => {
          // The renderer mutated diagram.nodes directly (via $bindable)
          // before emitting this event — invalidate cached sheets now.
          diagramState.invalidateSheetCache()
        }}
        onnodedelete={(ids: string[]) => {
          diagramState.unbindNodes(ids)
          diagramState.invalidateSheetCache()
        }}
        oncreatelink={(from: LinkEndpoint, to: LinkEndpoint) => {
          diagramState.addLink({ id: newId('link'), from, to })
        }}
      />
    {:else}
      <div class="flex items-center justify-center h-full text-neutral-400 dark:text-neutral-500">
        {diagramState.status}
      </div>
    {/if}
  </div>

  <!-- Top-left: Undo / Redo header bar -->
  <div class="fixed top-3 left-3 z-20"><HeaderBar /></div>

  <!-- Top-right: Export -->
  <div class="fixed top-3 right-3 z-20">
    <ExportMenu onexportjson={handleExportJson} onexportsvg={handleExportSvg} />
  </div>

  <!-- Right: diagram-side tools. -->
  <div class="fixed right-3 top-1/2 -translate-y-1/2 z-20">
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
  <div class="fixed bottom-3 left-3 z-20">
    <StatusBadge status={diagramState.status} stats={diagramState.stats} {selected} />
  </div>

  <!-- Left side: Code panel (slide-out) -->
  <div class="fixed left-3 top-1/2 -translate-y-1/2 z-20 h-[80vh] flex">
    <CodePanel bind:isOpen={codePanelOpen} />
  </div>

  <!-- Bottom-center: segmented Diagram | Scene view picker. -->
  <div class="fixed bottom-3 left-1/2 -translate-x-1/2 z-20"><ViewBar /></div>

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

  <!-- Element right-click and empty-canvas right-click both flow into
       the same registry-driven menu. Element right-click first sets
       `selected` so registry actions see the clicked element as the
       active selection (Copy / Delete / Information / Duplicate gate
       on selection). -->

  <DetailPanel
    open={detailPanel.open}
    elementType={detailPanel.target?.type ?? null}
    elementId={detailPanel.target?.id ?? null}
    onclose={() => detailPanel.close()}
  />

  <CanvasContextMenu bind:open={canvasMenuOpen} x={canvasMenuX} y={canvasMenuY} ctx={actionCtx} />
</div>
