<script lang="ts">
  import { darkTheme, lightTheme } from '@shumoku/core'
  import { attachCamera, type Camera } from '@shumoku/renderer'
  import ShumokuRenderer from '@shumoku/renderer/components/ShumokuRenderer.svelte'
  import EmptyState from '$lib/ui/EmptyState.svelte'
  import Toolbar from '$lib/ui/Toolbar.svelte'
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

<section class="relative min-h-0 min-w-0 flex-1 overflow-hidden" aria-label="Preview">
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
    <div class="workbench-preview-controls">
      <span class="min-w-12 text-center">{scale}%</span>
      <Toolbar
        compact
        label="Diagram view"
        actions={[
        { id: 'out', label: 'Zoom out', text: '−', onclick: () => camera?.zoomBy(0.8) },
        { id: 'in', label: 'Zoom in', text: '+', onclick: () => camera?.zoomBy(1.25) },
        { id: 'fit', label: 'Fit diagram', text: 'Fit', onclick: () => camera?.reset() },
      ]}
      />
    </div>
  {:else}
    <div class="flex h-full min-h-64 items-center justify-center">
      <EmptyState title="No diagram yet" description="Choose Render to preview the YAML source." />
    </div>
  {/if}
</section>

<style>
  section {
    background: var(--ui-workspace-canvas);
    color: var(--site-fg);
  }
  section > :global(svg) {
    width: 100%;
    height: 100%;
  }
</style>
