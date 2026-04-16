<script lang="ts">
  // @ts-expect-error — SvelteKit resolves the svelte condition from package.json exports
  import ShumokuRenderer from '@shumoku/renderer/components/ShumokuRenderer.svelte'
  import { renderGraphToSvg } from '@shumoku/renderer-svg'
  import { nanoid } from 'nanoid'
  import DetailPanel from '$lib/components/DetailPanel.svelte'
  import ExportMenu from '$lib/components/ExportMenu.svelte'
  import LabelEditPopover from '$lib/components/LabelEditPopover.svelte'
  import NodeContextMenu from '$lib/components/NodeContextMenu.svelte'
  import SheetBar from '$lib/components/SheetBar.svelte'
  import SideToolbar from '$lib/components/SideToolbar.svelte'
  import StatusBadge from '$lib/components/StatusBadge.svelte'
  import { diagramState, editorState } from '$lib/context.svelte'

  // =========================================================================
  // Local UI state (page-specific, not shared)
  // =========================================================================

  let renderer: ShumokuRenderer | undefined = $state()
  let selected = $state<{ id: string; type: string } | null>(null)
  let contextMenu = $state<{ id: string; type: string; x: number; y: number } | null>(null)
  let clipboard = $state<{
    label: string
    shape?: string
    type?: string
    elementKind: 'node' | 'subgraph'
  } | null>(null)
  let detailTarget = $state<{ id: string; type: 'node' | 'link' | 'subgraph' } | null>(null)
  let labelEdit = $state<{ portId: string; label: string; x: number; y: number } | null>(null)

  // =========================================================================
  // Detail panel — resolve edge/port to their parent types
  // =========================================================================

  function openDetail(id: string, rawType: string) {
    if (rawType === 'node') {
      detailTarget = { id, type: 'node' }
    } else if (rawType === 'edge') {
      // Edge → find corresponding Link
      const edge = diagramState.edges.get(id)
      if (edge?.link?.id) {
        detailTarget = { id: edge.link.id, type: 'link' }
      }
    } else if (rawType === 'port') {
      // Port → open parent Node
      const port = diagramState.ports.get(id)
      if (port) {
        detailTarget = { id: port.nodeId, type: 'node' }
      }
    } else if (rawType === 'subgraph') {
      detailTarget = { id, type: 'subgraph' }
    }
  }

  // =========================================================================
  // Export
  // =========================================================================

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

<div class="relative h-screen w-screen overflow-hidden bg-neutral-50 dark:bg-neutral-950">
  <!-- Canvas (full screen, z-0) -->
  <div class="absolute inset-0">
    {#if diagramState.nodes.size > 0 || diagramState.status !== 'Loading...'}
      <ShumokuRenderer
        bind:this={renderer}
        bind:nodes={diagramState.nodes}
        bind:ports={diagramState.ports}
        bind:edges={diagramState.edges}
        bind:subgraphs={diagramState.subgraphs}
        bind:bounds={diagramState.bounds}
        bind:links={diagramState.links}
        theme={editorState.theme}
        mode={editorState.mode}
        onselect={(id: string | null, type: string | null) => { selected = id ? { id, type: type ?? 'node' } : null }}
        onchange={() => {}}
        onlabeledit={(portId: string, label: string, screenX: number, screenY: number) => { labelEdit = { portId, label, x: screenX, y: screenY } }}
        oncontextmenu={(id: string, type: string, screenX: number, screenY: number) => { contextMenu = { id, type, x: screenX, y: screenY } }}
        onnodeadd={(id: string) => {
          diagramState.addBomItem({ id: nanoid(), nodeId: id })
        }}
        onnodedelete={(ids: string[]) => { diagramState.unbindNodes(ids) }}
      />
    {:else}
      <div class="flex items-center justify-center h-full text-neutral-400 dark:text-neutral-500">
        {diagramState.status}
      </div>
    {/if}
  </div>

  <!-- Top-right: Export -->
  <div class="fixed top-3 right-3 z-20">
    <ExportMenu onexportjson={handleExportJson} onexportsvg={handleExportSvg} />
  </div>

  <!-- Right: Side toolbar -->
  <div class="fixed right-3 top-1/2 -translate-y-1/2 z-20">
    <SideToolbar
      mode={editorState.mode}
      isDark={editorState.isDark}
      onmodechange={(m) => { editorState.mode = m }}
      onaddnode={(spec) => renderer?.addNewNode(spec ? { spec } : undefined)}
      onaddsubgraph={() => renderer?.addNewSubgraph()}
      onthemetoggle={() => editorState.toggleTheme()}
    />
  </div>

  <!-- Bottom-left: Status -->
  <div class="fixed bottom-3 left-3 z-20">
    <StatusBadge status={diagramState.status} stats={diagramState.stats} {selected} />
  </div>

  <!-- Bottom-center: Sheet bar -->
  <div class="fixed bottom-3 left-1/2 -translate-x-1/2 z-20"><SheetBar /></div>

  <!-- Overlays -->

  {#if labelEdit}
    <LabelEditPopover
      portId={labelEdit.portId}
      label={labelEdit.label}
      x={labelEdit.x}
      y={labelEdit.y}
      oncommit={(portId, value) => renderer?.commitLabel(portId, value)}
      onclose={() => { labelEdit = null }}
    />
  {/if}

  {#if contextMenu}
    <NodeContextMenu
      id={contextMenu.id}
      type={contextMenu.type}
      x={contextMenu.x}
      y={contextMenu.y}
      mode={editorState.mode}
      hasClipboard={clipboard !== null}
      oncopy={(id) => {
        const info = renderer?.getElementInfo(id)
        clipboard = info ? { label: info.label, shape: info.kind === 'node' ? info.shape : undefined, type: info.kind === 'node' ? info.type : undefined, elementKind: info.kind } : null
      }}
      onpaste={() => {
        if (!clipboard || !contextMenu) return
        const svgPos = renderer?.screenToSvg(contextMenu.x, contextMenu.y)
        if (clipboard.elementKind === 'subgraph') renderer?.addNewSubgraph({ label: clipboard.label, position: svgPos })
        else renderer?.addNewNode({ label: clipboard.label, type: clipboard.type, shape: clipboard.shape, position: svgPos })
      }}
      ondetails={(id) => openDetail(id, contextMenu?.type ?? 'node')}
      ondelete={(id) => { renderer?.deleteById(id) }}
      onclose={() => { contextMenu = null }}
    />
  {/if}

  <DetailPanel
    open={detailTarget !== null}
    elementType={detailTarget?.type ?? null}
    elementId={detailTarget?.id ?? null}
    onclose={() => { detailTarget = null }}
  />
</div>
