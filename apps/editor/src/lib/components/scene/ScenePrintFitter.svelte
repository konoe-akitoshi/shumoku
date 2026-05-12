<script lang="ts">
  import { useSvelteFlow } from '@xyflow/svelte'
  import { onDestroy, onMount } from 'svelte'

  /**
   * Print hook for the scene canvas.
   *
   * Cmd+P (and `window.print()`) fires a `beforeprint` event on the
   * window right before the browser builds its print preview. We
   * use that to force the Svelte Flow viewport to fit-all so the
   * printed page captures every node + the floor-plan background,
   * regardless of where the user was panned/zoomed onscreen.
   *
   * `afterprint` doesn't reset the viewport on purpose — once the
   * print dialog closes the user is probably looking at the same
   * thing they want to print anyway, and snapping back to the
   * previous viewport would be confusing.
   *
   * Must live INSIDE a `<SvelteFlow>` so `useSvelteFlow()` resolves
   * the current canvas's API (each canvas has its own viewport).
   */

  const sf = useSvelteFlow()

  function fitForPrint() {
    sf.fitView({ padding: 0.04, duration: 0 })
  }

  onMount(() => {
    window.addEventListener('beforeprint', fitForPrint)
  })
  onDestroy(() => {
    window.removeEventListener('beforeprint', fitForPrint)
  })
</script>
