<script lang="ts">
  import { type LinkEndpoint, newId } from '@shumoku/core'
  import { attachCamera } from '@shumoku/renderer'
  import ShumokuRenderer from '@shumoku/renderer/components/ShumokuRenderer.svelte'
  import { page } from '$app/stores'
  import { clearActionContext, provideActionContext } from '$lib/actions/context-provider.svelte'
  import type { ActionContext, CameraHandle, RendererHandle } from '$lib/actions/types'
  import LabelEditPopover from '$lib/components/LabelEditPopover.svelte'
  import SideToolbar from '$lib/components/SideToolbar.svelte'
  import StatusBadge from '$lib/components/StatusBadge.svelte'
  import { diagramState, editorState } from '$lib/context.svelte'
  import { openCanvasMenu } from '$lib/state/canvas-menu.svelte'
  import { detailPanel } from '$lib/state/detail-panel.svelte'

  // Diagram-specific state. Shared chrome (HeaderBar / ExportMenu /
  // ViewBar / CodePanel / DetailPanel / CanvasContextMenu /
  // preventBrowserZoom) lives in the (canvas) layout.

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
  let labelEdit = $state<{ portId: string; label: string; x: number; y: number } | null>(null)

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
    camera: cameraHandle ?? undefined,
    renderer: rendererHandle,
  })

  // Publish to the global slot so the keyboard handler + toolbar
  // buttons + the layout's CanvasContextMenu see this page's ctx.
  $effect(() => {
    provideActionContext(actionCtx)
    return clearActionContext
  })

  // Resolve edge / port to their parent Node / Link before opening
  // the detail panel. The `ui.openDetails` action only opens what
  // it's given; this helper does the editor-store-aware
  // resolution that the action can't.
  function openDetail(id: string, rawType: string) {
    if (rawType === 'node') {
      detailPanel.show({ id, type: 'node' })
    } else if (rawType === 'edge') {
      const edge = diagramState.edges.get(id)
      if (edge?.link?.id) detailPanel.show({ id: edge.link.id, type: 'link' })
    } else if (rawType === 'port') {
      const port = diagramState.ports.get(id)
      if (port) detailPanel.show({ id: port.nodeId, type: 'node' })
    } else if (rawType === 'subgraph') {
      detailPanel.show({ id, type: 'subgraph' })
    }
  }
</script>

<div class="absolute inset-0">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="absolute inset-0"
    ondblclick={() => {
      if (selected) openDetail(selected.id, selected.type)
    }}
    oncontextmenu={(e) => {
      // Per-element handlers stopPropagation, so this only fires on
      // empty canvas. Open the registry-driven menu (rendered by
      // the (canvas) layout) at the click position.
      e.preventDefault()
      openCanvasMenu(e.clientX, e.clientY)
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
        onselect={(id, type) => {
          selected = id ? { id, type: type ?? 'node' } : null
        }}
        onchange={() => {}}
        onlabeledit={(portId, label, screenX, screenY) => {
          labelEdit = { portId, label, x: screenX, y: screenY }
        }}
        oncontextmenu={(id, type, screenX, screenY) => {
          // Right-click selects the element so the registry menu
          // sees it as the active selection, then opens the menu.
          selected = { id, type }
          openCanvasMenu(screenX, screenY)
        }}
        onnodeadd={() => {
          // The renderer mutated diagram.nodes directly (via $bindable)
          // before emitting this event — invalidate cached sheets now.
          diagramState.invalidateSheetCache()
        }}
        onnodedelete={(ids) => {
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
</div>

<!-- Right: diagram-side tools (mode, add node, add subgraph, theme). -->
<div class="fixed right-3 top-1/2 -translate-y-1/2 z-20">
  <SideToolbar
    mode={editorState.mode}
    isDark={editorState.isDark}
    onmodechange={(m) => {
      editorState.mode = m
    }}
    onaddnode={(spec) => renderer?.addNewNode({ id: newId('node'), ...(spec ? { spec } : {}) })}
    onaddsubgraph={() => renderer?.addNewSubgraph({ id: newId('sg') })}
    onthemetoggle={() => editorState.toggleTheme()}
  />
</div>

<!-- Bottom-left: status badge with current selection. -->
<div class="fixed bottom-3 left-3 z-20">
  <StatusBadge status={diagramState.status} stats={diagramState.stats} {selected} />
</div>

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
    onclose={() => {
      labelEdit = null
    }}
  />
{/if}
