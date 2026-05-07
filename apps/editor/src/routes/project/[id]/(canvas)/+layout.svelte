<script lang="ts">
  import { renderGraphToSvg } from '@shumoku/renderer-svg'
  import CanvasContextMenu from '$lib/components/CanvasContextMenu.svelte'
  import CodePanel from '$lib/components/CodePanel.svelte'
  import DetailPanel from '$lib/components/DetailPanel.svelte'
  import ExportMenu from '$lib/components/ExportMenu.svelte'
  import HeaderBar from '$lib/components/HeaderBar.svelte'
  import ViewBar from '$lib/components/view-bar/ViewBar.svelte'
  import { diagramState } from '$lib/context.svelte'
  import { detailPanel } from '$lib/state/detail-panel.svelte'
  import { preventBrowserZoom } from '$lib/utils/prevent-browser-zoom'

  // Shared chrome for canvas-style routes (/diagram, /scene). Both
  // pages render the same fixed-position toolbar set; before this
  // layout each duplicated the imports, the export handlers, the
  // CanvasContextMenu plumbing, and the preventBrowserZoom hook.
  // Only the canvas content + page-specific overlays (e.g. diagram
  // SideToolbar, scene SceneSideToolbar) live in the page now.

  let { children } = $props()

  preventBrowserZoom()

  function downloadFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleExportJson() {
    const graph = diagramState.exportGraph()
    downloadFile(JSON.stringify(graph, null, 2), 'diagram.json', 'application/json')
  }

  async function handleExportSvg() {
    const graph = diagramState.exportGraph()
    const svg = await renderGraphToSvg(graph)
    downloadFile(svg, 'diagram.svg', 'image/svg+xml')
  }
</script>

<!-- Full-screen canvas wrapper. Pages render their canvas
     element absolutely inside this; the chrome below floats on
     top via z-20. -->
<div class="relative h-screen w-screen overflow-hidden bg-neutral-50 dark:bg-neutral-950">
  {@render children()}
</div>

<!-- Top-left: Undo / Redo header bar. -->
<div class="fixed top-3 left-3 z-20"><HeaderBar /></div>

<!-- Top-right: Export menu. -->
<div class="fixed top-3 right-3 z-20">
  <ExportMenu onexportjson={handleExportJson} onexportsvg={handleExportSvg} />
</div>

<!-- Left side: Code panel (slide-out). -->
<div class="fixed left-3 top-1/2 z-20 flex h-[80vh] -translate-y-1/2"><CodePanel /></div>

<!-- Bottom-center: segmented Diagram | Scene view picker. -->
<div class="fixed bottom-3 left-1/2 z-20 -translate-x-1/2"><ViewBar /></div>

<!-- Right-side detail panel for the selected element. -->
<DetailPanel
  open={detailPanel.open}
  elementType={detailPanel.target?.type ?? null}
  elementId={detailPanel.target?.id ?? null}
  onclose={() => detailPanel.close()}
/>

<!-- Single canvas right-click menu for both pages. -->
<CanvasContextMenu />
