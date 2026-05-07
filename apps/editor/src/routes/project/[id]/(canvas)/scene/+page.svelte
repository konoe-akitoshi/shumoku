<script lang="ts">
  import { page } from '$app/stores'
  import { clearActionContext, provideActionContext } from '$lib/actions/context-provider.svelte'
  import type { ActionContext } from '$lib/actions/types'
  import StatusBadge from '$lib/components/StatusBadge.svelte'
  import SceneCanvas from '$lib/components/scene/SceneCanvas.svelte'
  import SceneSideToolbar from '$lib/components/scene/SceneSideToolbar.svelte'
  import { diagramState } from '$lib/context.svelte'
  import { openCanvasMenu } from '$lib/state/canvas-menu.svelte'

  // Scene-specific state. Shared chrome (HeaderBar / ExportMenu /
  // ViewBar / CodePanel / DetailPanel / CanvasContextMenu /
  // preventBrowserZoom) lives in the (canvas) layout.
  //
  // URL convention:
  //   /project/[id]/scene                → root scene
  //   /project/[id]/scene?focus=<sgId>   → scoped scene
  // Same `focus` param as /diagram so toggling between modes
  // preserves the user's drilldown.

  $effect(() => {
    const focus = $page.url.searchParams.get('focus')
    const focusId = focus || null
    if (diagramState.currentSheetId !== focusId) {
      diagramState.switchSheet(focusId)
    }
    const want = focus || undefined
    const have = diagramState.currentScene
    // The "no scene yet" case has to be handled explicitly: at
    // root both `have?.scopeSubgraphId` and `want` are
    // `undefined`, so a bare `!==` would short-circuit and never
    // create the root scene.
    if (!have || have.scopeSubgraphId !== want) {
      diagramState.setCurrentSceneForScope(want)
    }
  })

  // Scene's view actions render disabled until a Svelte Flow
  // camera adapter lands (tracked in #184).
  const actionCtx = $derived<ActionContext>({
    mode: 'scene',
    selection: { ids: [], types: [] },
  })
  $effect(() => {
    provideActionContext(actionCtx)
    return clearActionContext
  })
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="absolute inset-0"
  oncontextmenu={(e) => {
    // Per-element handlers in Svelte Flow stopPropagation so this
    // only fires for empty-canvas right-clicks.
    e.preventDefault()
    openCanvasMenu(e.clientX, e.clientY)
  }}
>
  {#if diagramState.currentScene}
    <SceneCanvas scene={diagramState.currentScene} />
  {:else}
    <div class="flex h-full items-center justify-center text-neutral-400 dark:text-neutral-500">
      {diagramState.status}
    </div>
  {/if}
</div>

<!-- Right: scene-side toolbar (background, calibration, hide / scale). -->
<div class="fixed top-1/2 right-3 z-20 -translate-y-1/2">
  {#if diagramState.currentSceneId !== null}
    <SceneSideToolbar sceneId={diagramState.currentSceneId} />
  {/if}
</div>

<!-- Bottom-left: status badge. -->
<div class="fixed bottom-3 left-3 z-20">
  <StatusBadge status={diagramState.status} stats={diagramState.stats} selected={null} />
</div>
