<script lang="ts">
  import { useSvelteFlow } from '@xyflow/svelte'
  import { onMount, untrack } from 'svelte'

  // Tiny child of <SvelteFlow> that runs `fitBounds` (or `fitView`)
  // once on mount. Lives inside the SvelteFlow provider context so
  // the hook can resolve. Re-runs whenever `bounds` changes (e.g.
  // background image gets uploaded after initial load).

  let {
    bounds,
  }: {
    bounds: { x: number; y: number; width: number; height: number } | null
  } = $props()

  const sf = useSvelteFlow()

  onMount(() => {
    queueMicrotask(() => fit(untrack(() => bounds)))
  })

  $effect(() => {
    fit(bounds)
  })

  function fit(b: typeof bounds) {
    if (b) sf.fitBounds(b, { padding: 0.1, duration: 0 })
    else sf.fitView({ padding: 0.1, duration: 0 })
  }
</script>
