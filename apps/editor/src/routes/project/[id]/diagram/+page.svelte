<script lang="ts">
  // @ts-expect-error — SvelteKit resolves the svelte condition from package.json exports
  import ShumokuRenderer from '@shumoku/renderer/components/ShumokuRenderer.svelte'
  import { nanoid } from 'nanoid'
  import CodePanel from '$lib/components/CodePanel.svelte'
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
  let codePanelOpen = $state(false)
  let selected = $state<{ id: string; type: string } | null>(null)
  let contextMenu = $state<{ id: string; type: string; x: number; y: number } | null>(null)
  let clipboard = $state<{
    label: string
    shape?: string
    type?: string
    elementKind: 'node' | 'subgraph'
  } | null>(null)
  // biome-ignore lint/suspicious/noExplicitAny: mixed element detail data
  let detailData = $state<Record<string, any> | null>(null)
  let labelEdit = $state<{ portId: string; label: string; x: number; y: number } | null>(null)

  // =========================================================================
  // Derived from shared state
  // =========================================================================

  let jsonSource = $state('{}')
  $effect(() => {
    jsonSource = diagramState.stateToJson()
  })

  // =========================================================================
  // Init — trigger shared state initialization
  // =========================================================================

  // =========================================================================
  // Apply
  // =========================================================================

  function applyJson(jsonStr: string) {
    try {
      diagramState.loadFromJson(jsonStr)
    } catch (_e) {
      // JSON parse error
    }
  }

  // =========================================================================
  // File
  // =========================================================================

  function handleSave() {
    const blob = new Blob([diagramState.stateToJson()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'network-diagram.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleLoad() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      applyJson(await file.text())
    }
    input.click()
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
      />
    {:else}
      <div class="flex items-center justify-center h-full text-neutral-400 dark:text-neutral-500">
        {diagramState.status}
      </div>
    {/if}
  </div>

  <!-- Top-right: Export -->
  <div class="fixed top-3 right-3 z-20"><ExportMenu onsave={handleSave} onload={handleLoad} /></div>

  <!-- Left: Code panel -->
  <div class="fixed top-3 bottom-3 left-3 z-30">
    <CodePanel
      open={codePanelOpen}
      yaml={diagramState.yamlSource}
      json={jsonSource}
      ontoggle={() => { codePanelOpen = !codePanelOpen }}
      onyamlchange={(v) => { diagramState.yamlSource = v }}
      onjsonchange={(v) => { jsonSource = v }}
      onyamlapply={() => diagramState.applyYaml(diagramState.yamlSource)}
      onjsonapply={() => applyJson(jsonSource)}
    />
  </div>

  <!-- Right: Side toolbar -->
  <div class="fixed right-3 top-1/2 -translate-y-1/2 z-20">
    <SideToolbar
      mode={editorState.mode}
      isDark={editorState.isDark}
      onmodechange={(m) => { editorState.mode = m }}
      onaddnode={() => renderer?.addNewNode()}
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
      ondetails={(id) => { detailData = renderer?.getElementDetails(id) ?? null }}
      ondelete={(id) => { renderer?.deleteById(id) }}
      onclose={() => { contextMenu = null }}
    />
  {/if}

  <DetailPanel
    open={detailData !== null}
    data={detailData}
    mode={editorState.mode}
    poeBudget={diagramState.poeBudgets.find((b) => b.nodeId === detailData?.id)}
    catalog={diagramState.catalog}
    palette={diagramState.palette}
    links={diagramState.links}
    onclose={() => { detailData = null }}
    onbindpalette={(nodeId, paletteId) => {
      // Find or create BOM item for this binding
      const existing = diagramState.bomItems.find((i) => i.nodeId === nodeId)
      if (existing) {
        // Re-bind to different palette entry
        diagramState.updateBomItem(existing.id, { paletteId })
      } else {
        // Find unplaced BOM item for this palette entry, or create new
        const unplaced = diagramState.bomItems.find((i) => i.paletteId === paletteId && !i.nodeId)
        if (unplaced) {
          diagramState.bindNodeToBom(unplaced.id, nodeId)
        } else {
          diagramState.addBomItem({ id: nanoid(), paletteId, nodeId })
        }
      }
    }}
    onupdate={(id, field, value) => {
      const node = diagramState.nodes.get(id)
      if (node) {
        const updated = { ...node, node: { ...node.node, [field]: value } }
        const n = new Map(diagramState.nodes)
        n.set(id, updated)
        diagramState.nodes = n
        detailData = renderer?.getElementDetails(id) ?? null
        return
      }
      const sg = diagramState.subgraphs.get(id)
      if (sg) {
        const updated = { ...sg, subgraph: { ...sg.subgraph, [field]: value } }
        const s = new Map(diagramState.subgraphs)
        s.set(id, updated)
        diagramState.subgraphs = s
        detailData = renderer?.getElementDetails(id) ?? null
      }
    }}
  />
</div>
