<script lang="ts">
  import { useSvelteFlow } from '@xyflow/svelte'
  import { onMount, untrack } from 'svelte'

  // Tiny child of <SvelteFlow> that fits the viewport to `bounds` —
  // once on mount, and whenever the *bounds reference key* changes
  // (e.g. background image swapped). NOT reactive on bounds itself,
  // because fitBounds nudges Svelte Flow's internal state which can
  // re-derive bounds → infinite loop.

  let {
    bounds,
    /** A stable string that changes only when a refit is desired
     *  (e.g. `bg.src` for the background image). Empty = no refit. */
    refitKey = '',
  }: {
    bounds: { x: number; y: number; width: number; height: number } | null
    refitKey?: string
  } = $props()

  const sf = useSvelteFlow()

  onMount(() => {
    queueMicrotask(() =>
      fit(
        untrack(() => bounds),
        untrack(() => refitKey),
      ),
    )
  })

  let lastKey = ''
  $effect(() => {
    const key = refitKey
    if (key === lastKey) return
    lastKey = key
    queueMicrotask(() =>
      fit(
        untrack(() => bounds),
        key,
      ),
    )
  })

  function fit(b: typeof bounds, _key: string) {
    if (b) sf.fitBounds(b, { padding: 0.1, duration: 0 })
    else sf.fitView({ padding: 0.1, duration: 0 })
  }
</script>
