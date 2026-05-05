<script lang="ts">
  import { useSvelteFlow } from '@xyflow/svelte'
  import { onMount, untrack } from 'svelte'

  // Tiny child of <SvelteFlow> that fits the viewport — once on
  // mount, and again whenever `refitKey` changes (e.g. background
  // image swapped). When `fitNodeId` is set, fits that node alone
  // (Svelte Flow uses its measured rect); otherwise falls back to
  // fitView.

  let {
    fitNodeId = null,
    refitKey = '',
  }: {
    fitNodeId?: string | null
    refitKey?: string
  } = $props()

  const sf = useSvelteFlow()

  onMount(() => {
    schedule(untrack(() => fitNodeId))
  })

  let lastKey = ''
  $effect(() => {
    const key = refitKey
    if (key === lastKey) return
    lastKey = key
    schedule(untrack(() => fitNodeId))
  })

  /** Wait a few frames so Svelte Flow has measured the node before
   *  fitting — otherwise `fitView({ nodes })` sees zero-sized nodes
   *  and the viewport ends up wrong. */
  function schedule(id: string | null) {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (id) {
          sf.fitView({ nodes: [{ id }], padding: 0.1, duration: 0 })
        } else {
          sf.fitView({ padding: 0.1, duration: 0 })
        }
      }),
    )
  }
</script>
