<script lang="ts">
  import { useSvelteFlow } from '@xyflow/svelte'
  import { diagramState } from '$lib/context.svelte'
  import { sceneAuthoring } from './scene-authoring.svelte'

  // Lives inside <SvelteFlow> so useSvelteFlow's screenToFlowPosition
  // hook is available. Receives pane-click coords from the parent
  // SceneCanvas and runs the 2-click calibration capture flow:
  //
  //   click 1 → store from
  //   click 2 → prompt for meters, save calibration
  //
  // Caller bumps `paneClick.n` on each click so this component's
  // effect re-fires even when the click coords coincide.

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
    if (!auth.calibrationMode) return

    const flow = sf.screenToFlowPosition({ x: paneClick.x, y: paneClick.y })
    if (!auth.calibrationMode.from) {
      auth.calibrationMode = { from: flow }
      return
    }

    const from = auth.calibrationMode.from
    const to = flow
    auth.calibrationMode = null
    const meters = Number(window.prompt('Reference distance (meters)', '1') ?? '')
    if (Number.isFinite(meters) && meters > 0) {
      const px = Math.hypot(to.x - from.x, to.y - from.y)
      if (px > 0) {
        diagramState.updateScene(sceneId, {
          calibration: {
            pxPerMeter: px / meters,
            reference: { from, to, meters },
          },
        })
      }
    }
  })
</script>
