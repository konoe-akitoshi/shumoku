<script lang="ts">
  import { useNodesInitialized, useSvelteFlow } from '@xyflow/svelte'

  // Fit the viewport to `bounds` once Svelte Flow reports initialized.
  // Without waiting, fitBounds runs before the viewport has been
  // measured and silently no-ops, leaving whatever fitView painted.
  // Refit again only when `refitKey` (e.g. bg.src) changes — Svelte
  // Flow mutates internal state during fit, which would otherwise
  // loop a reactive effect on bounds.

  let {
    bounds,
    refitKey = '',
  }: {
    bounds: { x: number; y: number; width: number; height: number } | null
    refitKey?: string
  } = $props()

  const sf = useSvelteFlow()
  const initialized = useNodesInitialized()

  let lastKey = '<<unset>>'
  $effect(() => {
    if (!initialized.current) return
    if (refitKey === lastKey) return
    lastKey = refitKey
    if (bounds) sf.fitBounds(bounds, { padding: 0.1, duration: 0 })
    else sf.fitView({ padding: 0.1, duration: 0 })
  })
</script>
