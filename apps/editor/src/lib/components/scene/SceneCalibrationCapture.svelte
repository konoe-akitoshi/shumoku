<script lang="ts">
  import { useSvelteFlow, ViewportPortal } from '@xyflow/svelte'
  import { onDestroy, onMount } from 'svelte'
  import { diagramState } from '$lib/context.svelte'
  import { sceneAuthoring } from './scene-authoring.svelte'

  // Lives inside <SvelteFlow> so screenToFlowPosition is available.
  // Owns the 2-click calibration capture flow:
  //   click 1   → store from + show marker
  //   move      → show live dashed preview to cursor
  //   click 2   → open floating meters input
  //   submit    → save calibration, render persistent reference
  //   Esc       → cancel at any step

  let {
    sceneId,
    paneClick,
  }: {
    sceneId: string
    paneClick: { x: number; y: number; n: number } | null
  } = $props()

  const sf = useSvelteFlow()
  const auth = sceneAuthoring

  // Persistent reference for an already-calibrated scene.
  const reference = $derived(
    diagramState.scenes.find((s) => s.id === sceneId)?.calibration?.reference,
  )

  // Pending second-point prompt. Holds 'from' and 'to' until the
  // user types a distance and submits.
  let prompt = $state<{
    from: { x: number; y: number }
    to: { x: number; y: number }
  } | null>(null)
  let metersInput = $state('1')
  let promptInputEl: HTMLInputElement | null = $state(null)

  // Live cursor (for the dashed preview line). Captured via window
  // pointermove only while we're mid-capture.
  let cursorFlow = $state<{ x: number; y: number } | null>(null)

  function onPointerMove(e: PointerEvent) {
    if (!auth.calibrationMode?.from) return
    cursorFlow = sf.screenToFlowPosition({ x: e.clientX, y: e.clientY })
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      auth.calibrationMode = null
      cursorFlow = null
      prompt = null
    }
  }
  onMount(() => {
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('keydown', onKey)
  })
  onDestroy(() => {
    if (typeof window === 'undefined') return
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('keydown', onKey)
  })

  // Pane-click capture relayed from SceneCanvas.
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
    // 2nd click: open the prompt; calibrationMode stays alive until
    // we either submit or cancel.
    prompt = { from: auth.calibrationMode.from, to: flow }
    auth.calibrationMode = null
    metersInput = '1'
    queueMicrotask(() => promptInputEl?.focus())
  })

  function submit() {
    if (!prompt) return
    const meters = Number(metersInput)
    if (Number.isFinite(meters) && meters > 0) {
      const px = Math.hypot(prompt.to.x - prompt.from.x, prompt.to.y - prompt.from.y)
      if (px > 0) {
        diagramState.updateScene(sceneId, {
          calibration: {
            pxPerMeter: px / meters,
            reference: { from: prompt.from, to: prompt.to, meters },
          },
        })
      }
    }
    prompt = null
    cursorFlow = null
  }
  function cancel() {
    prompt = null
    cursorFlow = null
  }
</script>

<!-- Visual capture/reference overlay rendered inside the viewport so
     it pans/zooms with the scene. -->
<ViewportPortal target="front">
  <svg
    style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none;"
  >
    <!-- Persistent reference line (faint dashed amber) once
         calibration is set and we're not in the middle of recapturing. -->
    {#if reference && !auth.calibrationMode && !prompt}
      <line
        x1={reference.from.x}
        y1={reference.from.y}
        x2={reference.to.x}
        y2={reference.to.y}
        stroke="#f59e0b"
        stroke-width="1"
        stroke-dasharray="4 4"
        opacity="0.6"
      />
      <circle cx={reference.from.x} cy={reference.from.y} r="3" fill="#f59e0b" opacity="0.7" />
      <circle cx={reference.to.x} cy={reference.to.y} r="3" fill="#f59e0b" opacity="0.7" />
    {/if}

    <!-- During 1st-click waiting: nothing extra (the top hint covers it) -->

    <!-- After 1st click: show the from marker + dashed line to cursor -->
    {#if auth.calibrationMode?.from}
      <circle
        cx={auth.calibrationMode.from.x}
        cy={auth.calibrationMode.from.y}
        r="5"
        fill="#3b82f6"
        stroke="white"
        stroke-width="2"
      />
      {#if cursorFlow}
        <line
          x1={auth.calibrationMode.from.x}
          y1={auth.calibrationMode.from.y}
          x2={cursorFlow.x}
          y2={cursorFlow.y}
          stroke="#3b82f6"
          stroke-width="2"
          stroke-dasharray="6 4"
        />
      {/if}
    {/if}

    <!-- During prompt: solid blue line between picked points -->
    {#if prompt}
      <line
        x1={prompt.from.x}
        y1={prompt.from.y}
        x2={prompt.to.x}
        y2={prompt.to.y}
        stroke="#3b82f6"
        stroke-width="2"
      />
      <circle
        cx={prompt.from.x}
        cy={prompt.from.y}
        r="5"
        fill="#3b82f6"
        stroke="white"
        stroke-width="2"
      />
      <circle
        cx={prompt.to.x}
        cy={prompt.to.y}
        r="5"
        fill="#3b82f6"
        stroke="white"
        stroke-width="2"
      />
    {/if}
  </svg>
</ViewportPortal>

<!-- Floating in-canvas prompt for the meters value. Replaces window.prompt
     (which can't anchor to the canvas and looks alien). -->
{#if prompt}
  <div
    class="pointer-events-none fixed inset-0 z-30 flex items-center justify-center"
    style="position: fixed;"
  >
    <div
      class="pointer-events-auto flex items-center gap-2 rounded-xl border border-neutral-200 bg-white/95 px-3 py-2 text-xs shadow-2xl backdrop-blur dark:border-neutral-700 dark:bg-neutral-800/95"
    >
      <span class="text-neutral-700 dark:text-neutral-200">Real-world distance:</span>
      <input
        bind:this={promptInputEl}
        type="number"
        bind:value={metersInput}
        step="0.1"
        min="0"
        class="w-20 rounded border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
        onkeydown={(e) => {
          if (e.key === 'Enter') submit()
          else if (e.key === 'Escape') cancel()
        }}
      >
      <span class="text-neutral-500">m</span>
      <button
        type="button"
        class="rounded bg-blue-500 px-2 py-1 text-white hover:bg-blue-600"
        onclick={submit}
      >
        Save
      </button>
      <button
        type="button"
        class="rounded px-2 py-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700"
        onclick={cancel}
      >
        Cancel
      </button>
    </div>
  </div>
{/if}
