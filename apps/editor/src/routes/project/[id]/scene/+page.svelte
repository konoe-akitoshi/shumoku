<script lang="ts">
  import { renderGraphToSvg } from '@shumoku/renderer-svg'
  import { page } from '$app/stores'
  import type { ActionContext } from '$lib/actions/types'
  import CanvasContextMenu from '$lib/components/CanvasContextMenu.svelte'
  import CodePanel from '$lib/components/CodePanel.svelte'
  import DetailPanel from '$lib/components/DetailPanel.svelte'
  import ExportMenu from '$lib/components/ExportMenu.svelte'
  import HeaderBar from '$lib/components/HeaderBar.svelte'
  import StatusBadge from '$lib/components/StatusBadge.svelte'
  import SceneCanvas from '$lib/components/scene/SceneCanvas.svelte'
  import SceneSideToolbar from '$lib/components/scene/SceneSideToolbar.svelte'
  import ViewBar from '$lib/components/view-bar/ViewBar.svelte'
  import { diagramState } from '$lib/context.svelte'
  import { preventBrowserZoom } from '$lib/utils/prevent-browser-zoom'

  preventBrowserZoom()

  // Scene route — floor-plan view of a subgraph. URL convention:
  //   /project/[id]/scene                → root scene
  //   /project/[id]/scene?focus=<sgId>   → scoped scene
  // The same `focus` query param is used by /diagram so toggling
  // between view modes preserves the user's drilldown.

  let detailTarget = $state<{ id: string; type: 'node' | 'link' | 'subgraph' } | null>(null)

  // Sync URL → state. Hierarchy drilldown (currentSheetId) and scene
  // scope are unified through `focus`.
  $effect(() => {
    const focus = $page.url.searchParams.get('focus')
    const focusId = focus || null
    if (diagramState.currentSheetId !== focusId) {
      diagramState.switchSheet(focusId)
    }
    const want = focus || undefined
    const have = diagramState.currentScene
    // The "no scene yet" case has to be handled explicitly: at root
    // both `have?.scopeSubgraphId` and `want` are `undefined`, so a
    // bare `!==` would short-circuit and never create the root scene.
    if (!have || have.scopeSubgraphId !== want) {
      diagramState.setCurrentSceneForScope(want)
    }
  })

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

  let codePanelOpen = $state(false)

  // Canvas-level right-click menu (registry-driven). v1: no camera
  // handle from scene yet — view actions render disabled. Wiring
  // a CameraHandle through SceneCanvas → useSvelteFlow is a
  // follow-up.
  let canvasMenuOpen = $state(false)
  let canvasMenuX = $state(0)
  let canvasMenuY = $state(0)
  const actionCtx = $derived<ActionContext>({
    mode: 'scene',
    selection: { ids: [], types: [] },
    canvasPos: canvasMenuOpen ? { x: canvasMenuX, y: canvasMenuY } : undefined,
  })
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="relative h-screen w-screen overflow-hidden bg-neutral-50 dark:bg-neutral-950"
  oncontextmenu={(e) => {
    // Per-element handlers in Svelte Flow stopPropagation so this
    // only fires for empty-canvas right-clicks.
    e.preventDefault()
    canvasMenuX = e.clientX
    canvasMenuY = e.clientY
    canvasMenuOpen = true
  }}
>
  <div class="absolute inset-0">
    {#if diagramState.currentScene}
      <SceneCanvas scene={diagramState.currentScene} />
    {:else}
      <div class="flex h-full items-center justify-center text-neutral-400 dark:text-neutral-500">
        {diagramState.status}
      </div>
    {/if}
  </div>

  <div class="fixed top-3 left-3 z-20"><HeaderBar /></div>

  <div class="fixed top-3 right-3 z-20">
    <ExportMenu onexportjson={handleExportJson} onexportsvg={handleExportSvg} />
  </div>

  <div class="fixed top-1/2 right-3 z-20 -translate-y-1/2">
    {#if diagramState.currentSceneId !== null}
      <SceneSideToolbar sceneId={diagramState.currentSceneId} />
    {/if}
  </div>

  <div class="fixed bottom-3 left-3 z-20">
    <StatusBadge status={diagramState.status} stats={diagramState.stats} selected={null} />
  </div>

  <div class="fixed top-1/2 left-3 z-20 flex h-[80vh] -translate-y-1/2">
    <CodePanel bind:isOpen={codePanelOpen} />
  </div>

  <div class="fixed bottom-3 left-1/2 z-20 -translate-x-1/2"><ViewBar /></div>

  <DetailPanel
    open={detailTarget !== null}
    elementType={detailTarget?.type ?? null}
    elementId={detailTarget?.id ?? null}
    onclose={() => {
      detailTarget = null
    }}
  />

  <CanvasContextMenu bind:open={canvasMenuOpen} x={canvasMenuX} y={canvasMenuY} ctx={actionCtx} />
</div>
