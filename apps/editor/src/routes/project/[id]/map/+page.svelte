<script lang="ts">
  import { renderGraphToSvg } from '@shumoku/renderer-svg'
  import { onDestroy, onMount } from 'svelte'
  import ExportMenu from '$lib/components/ExportMenu.svelte'
  import HeaderBar from '$lib/components/HeaderBar.svelte'
  import { mapAuthoring } from '$lib/components/map/authoring.svelte'
  import MapCanvas from '$lib/components/map/MapCanvas.svelte'
  import MapToolbar from '$lib/components/map/MapToolbar.svelte'
  import ViewBar from '$lib/components/view-bar/ViewBar.svelte'
  import { diagramState } from '$lib/context.svelte'
  import { preventBrowserZoom } from '$lib/utils/prevent-browser-zoom'

  function download(content: string, filename: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }))
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
  function exportJson() {
    download(
      JSON.stringify(diagramState.exportGraph(), null, 2),
      'diagram.json',
      'application/json',
    )
  }
  async function exportSvg() {
    download(await renderGraphToSvg(diagramState.exportGraph()), 'diagram.svg', 'image/svg+xml')
  }
  preventBrowserZoom()
  onMount(() => diagramState.endTx())
  onDestroy(() => {
    mapAuthoring.cancelWireDrag?.()
    mapAuthoring.cancelWireDrag = undefined
    diagramState.endTx()
    mapAuthoring.placement = null
    mapAuthoring.calibration = null
  })
</script>
<div class="relative h-screen w-screen overflow-hidden bg-neutral-50 dark:bg-neutral-950">
  <div data-print-canvas class="absolute inset-0">
    {#if diagramState.mapWorkspace}
      <MapCanvas workspace={diagramState.mapWorkspace} />
    {:else}
      <div class="flex h-full items-center justify-center">{diagramState.status}</div>
    {/if}
  </div>
  <div data-print-hide class="fixed top-3 left-3 z-20"><HeaderBar /></div>
  <div data-print-hide class="fixed top-3 right-3 z-20">
    <ExportMenu onexportjson={exportJson} onexportsvg={exportSvg} />
  </div>
  <div data-print-hide class="pointer-events-none fixed bottom-20 left-1/2 z-20 -translate-x-1/2">
    <MapToolbar />
  </div>
  <div data-print-hide class="fixed bottom-3 left-1/2 z-20 -translate-x-1/2"><ViewBar /></div>
</div>
