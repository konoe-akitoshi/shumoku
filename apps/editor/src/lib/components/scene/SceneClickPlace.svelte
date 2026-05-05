<script lang="ts">
  import { useSvelteFlow } from '@xyflow/svelte'
  import { diagramState } from '$lib/context.svelte'
  import { sceneAuthoring } from './scene-authoring.svelte'

  // Lives inside <SvelteFlow> so screenToFlowPosition is available.
  // Drop handler for the side-toolbar's "Place" dropdown:
  //
  //   pendingPlacement.kind === 'empty'   → addEmptyNodeInScene
  //   pendingPlacement.kind === 'product' → placeProductInScene
  //
  // Click coords come down from SceneCanvas (same paneClick channel
  // as calibration).

  let {
    sceneId,
    paneClick,
  }: {
    sceneId: string
    paneClick: { x: number; y: number; n: number } | null
  } = $props()

  const sf = useSvelteFlow()
  const auth = sceneAuthoring

  let lastN = 0
  $effect(() => {
    if (!paneClick) return
    if (paneClick.n === lastN) return
    lastN = paneClick.n
    const pending = auth.pendingPlacement
    if (!pending) return

    const flow = sf.screenToFlowPosition({ x: paneClick.x, y: paneClick.y })
    if (pending.kind === 'product') {
      diagramState.placeProductInScene(sceneId, pending.productId, flow)
    } else if (pending.kind === 'termination') {
      diagramState.addTerminationInScene(sceneId, flow, pending.role)
    } else {
      diagramState.addEmptyNodeInScene(sceneId, flow)
    }
    auth.pendingPlacement = null
  })
</script>
