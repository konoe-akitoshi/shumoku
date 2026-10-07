<script lang="ts">
  import { useSvelteFlow, ViewportPortal } from '@xyflow/svelte'
  import { diagramState } from '$lib/context.svelte'
  import { MAP_UNITS_PER_METER, type Point } from '$lib/map/model'
  import { mapAuthoring as authoring } from './authoring.svelte'

  let { click }: { click: { x: number; y: number; n: number } | null } = $props()
  const sf = useSvelteFlow()
  let last = 0
  let prompt = $state<{ drawingId: string; from: Point; to: Point } | null>(null)
  let meters = $state<number | undefined>(1)
  let error = $state('')
  let input: HTMLInputElement | undefined = $state()
  const flowPoint = (p: Point, id: string): Point => {
    const d = diagramState.mapWorkspace?.map?.drawings.find((d) => d.id === id)
    return d ? { x: d.position.x + p.x * d.scale, y: d.position.y + p.y * d.scale } : p
  }
  $effect(() => {
    if (!click || click.n === last) return
    last = click.n
    const p = sf.screenToFlowPosition(click)
    const calibration = authoring.calibration
    if (calibration) {
      const d = diagramState.mapWorkspace?.map?.drawings.find((d) => d.id === calibration.drawingId)
      if (!d) {
        authoring.calibration = null
        return
      }
      const local = { x: (p.x - d.position.x) / d.scale, y: (p.y - d.position.y) / d.scale }
      if (local.x < 0 || local.y < 0 || local.x > d.width || local.y > d.height) return
      if (!calibration.from) authoring.calibration = { ...calibration, from: local }
      else {
        prompt = { drawingId: d.id, from: calibration.from, to: local }
        authoring.calibration = null
        meters = 1
        error = ''
        queueMicrotask(() => input?.focus())
      }
      return
    }
    const pending = authoring.placement
    if (!pending) return
    diagramState.beginTx('Place map item')
    try {
      let id: string | undefined
      if (pending.kind === 'existing') id = pending.nodeId
      else if (pending.kind === 'empty') id = diagramState.addEmptyNode()
      else if (pending.kind === 'product') id = diagramState.placeProductAsNode(pending.productId)
      else id = diagramState.addTermination(pending.role, p)
      if (id) diagramState.placeMapPoint(id, p)
    } finally {
      diagramState.endTx()
      authoring.placement = null
    }
  })
  function cancel() {
    prompt = null
    authoring.calibration = null
    authoring.placement = null
  }
  function save() {
    if (!prompt || meters === undefined || !Number.isFinite(meters) || meters <= 0) {
      error = 'Enter a distance greater than zero.'
      return
    }
    const px = Math.hypot(prompt.to.x - prompt.from.x, prompt.to.y - prompt.from.y)
    if (px < 1) {
      error = 'Choose two different reference points.'
      return
    }
    const pxPerMeter = px / meters
    diagramState.updateMapDrawing(prompt.drawingId, {
      scale: MAP_UNITS_PER_METER / pxPerMeter,
      calibration: { pxPerMeter, reference: { from: prompt.from, to: prompt.to, meters } },
    })
    cancel()
  }
</script>
<svelte:window onkeydown={(event) => { if (event.key === 'Escape') cancel() }} />
{#if authoring.calibration?.from}
  {@const p = flowPoint(authoring.calibration.from, authoring.calibration.drawingId)}
  <ViewportPortal target="front"
    ><svg
      aria-hidden="true"
      style="position:absolute;overflow:visible;pointer-events:none;width:1px;height:1px"
    >
      <circle cx={p.x} cy={p.y} r="5" fill="#3b82f6" />
    </svg></ViewportPortal
  >
{/if}
{#if prompt}
  <div
    data-print-hide
    class="nodrag nopan absolute top-20 left-1/2 z-50 -translate-x-1/2 rounded-xl border bg-white p-3 text-sm text-neutral-800 shadow-lg dark:bg-neutral-800 dark:text-neutral-100"
  >
    <form
      onsubmit={(e) => { e.preventDefault(); save() }}
      class="flex flex-wrap items-center gap-2"
    >
      <label
        >Reference distance
        <input
          bind:this={input}
          bind:value={meters}
          type="number"
          min="0.001"
          step="any"
          required
          class="w-24 rounded border bg-transparent px-2 py-1"
        >
        m</label
      >
      <button type="submit" class="rounded bg-blue-600 px-3 py-1 text-white">Apply scale</button>
      <button type="button" onclick={cancel}>Cancel</button>
    </form>
    {#if error}
      <p role="alert">{error}</p>
    {/if}
  </div>
{/if}
