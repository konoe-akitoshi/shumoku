<script lang="ts">
  import { darkTheme, lightTheme } from '@shumoku/core'
  import { attachCamera, type Camera } from '@shumoku/renderer'
  import ShumokuRenderer from '@shumoku/renderer/components/ShumokuRenderer.svelte'
  import type { RenderResult } from './render'

  let { result }: { result: RenderResult | null } = $props()
  let svgElement = $state<SVGSVGElement | null>(null)
  let camera = $state<Camera | null>(null)
  let scale = $state(100)
  $effect(() => {
    if (!svgElement) return
    const instance = attachCamera(svgElement, {
      panFilter: (event) => event.button === 0 || event.button === 1,
    })
    camera = instance
    const update = () => {
      scale = Math.round(instance.getTransform().k * 100)
    }
    const viewport = svgElement.querySelector('.viewport') ?? svgElement
    const observer = new MutationObserver(update)
    observer.observe(viewport, { attributes: true, subtree: true, attributeFilter: ['transform'] })
    update()
    return () => {
      observer.disconnect()
      instance.detach()
      camera = null
    }
  })
</script>

<section
  class="relative h-[50dvh] min-h-64 min-w-0 flex-1 overflow-hidden bg-neutral-100 md:h-auto dark:bg-neutral-950"
  aria-label="Preview"
>
  {#if result?.prepared.resolved}
    <div class="absolute inset-0">
      {#key result}
        <ShumokuRenderer
          layout={result.prepared.resolved}
          mode="view"
          theme={result.prepared.graph.settings?.theme === 'dark' ? darkTheme : lightTheme}
          bind:svgElement
        />
      {/key}
    </div>
    <div
      class="absolute right-4 bottom-4 flex items-center gap-2 rounded border border-neutral-200 bg-white p-1 text-sm text-neutral-800 shadow"
    >
      <button
        type="button"
        class="px-2 py-1"
        aria-label="Zoom out"
        onclick={() => camera?.zoomBy(0.8)}
      >
        −
      </button>
      <span class="min-w-12 text-center">{scale}%</span>
      <button
        type="button"
        class="px-2 py-1"
        aria-label="Zoom in"
        onclick={() => camera?.zoomBy(1.25)}
      >
        +
      </button>
      <button type="button" class="px-2 py-1" onclick={() => camera?.reset()}>Fit</button>
    </div>
  {:else}
    <div class="flex h-full min-h-64 items-center justify-center text-sm text-neutral-500">
      Click Render to preview
    </div>
  {/if}
</section>

<style>
  section > :global(svg) {
    width: 100%;
    height: 100%;
  }
</style>
