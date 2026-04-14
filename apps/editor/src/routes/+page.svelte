<script lang="ts">
  import {
    computeNetworkLayout,
    createMemoryFileResolver,
    HierarchicalParser,
    type Link,
    type ResolvedLayout,
    sampleNetwork,
  } from '@shumoku/core'
  // @ts-expect-error — SvelteKit resolves the svelte condition from package.json exports
  import ShumokuRenderer from '@shumoku/renderer/components/ShumokuRenderer.svelte'
  import AppTitle from '$lib/components/AppTitle.svelte'
  import DetailPanel from '$lib/components/DetailPanel.svelte'
  import ExportMenu from '$lib/components/ExportMenu.svelte'
  import LabelEditPopover from '$lib/components/LabelEditPopover.svelte'
  import NodeContextMenu from '$lib/components/NodeContextMenu.svelte'
  import SheetBar from '$lib/components/SheetBar.svelte'
  import SideToolbar from '$lib/components/SideToolbar.svelte'
  import StatusBadge from '$lib/components/StatusBadge.svelte'
  import { editorState, initDarkMode } from '$lib/context.svelte'

  // =========================================================================
  // State (editor-specific, not shared globally)
  // =========================================================================

  let renderer: ShumokuRenderer | undefined = $state()
  let status = $state('Loading...')
  let selected = $state<{ id: string; type: string } | null>(null)
  let contextMenu = $state<{
    id: string
    type: string
    x: number
    y: number
  } | null>(null)
  let clipboard = $state<{
    label: string
    shape?: string
    type?: string
    elementKind: 'node' | 'subgraph'
  } | null>(null)
  let stats = $state({ nodes: 0, links: 0, subgraphs: 0 })
  let layout = $state<ResolvedLayout | undefined>(undefined)
  let graph = $state<{ links: Link[] } | undefined>(undefined)
  // biome-ignore lint/suspicious/noExplicitAny: mixed element detail data
  let detailData = $state<Record<string, any> | null>(null)
  let labelEdit = $state<{
    portId: string
    label: string
    x: number
    y: number
  } | null>(null)

  // =========================================================================
  // Init dark mode observer
  // =========================================================================

  $effect(() => {
    return initDarkMode()
  })

  // =========================================================================
  // Init diagram
  // =========================================================================

  async function parseSampleNetwork() {
    const fileMap = new Map<string, string>()
    for (const f of sampleNetwork) {
      fileMap.set(f.name, f.content)
      fileMap.set(`./${f.name}`, f.content)
      fileMap.set(`/${f.name}`, f.content)
    }
    const resolver = createMemoryFileResolver(fileMap, '/')
    const hp = new HierarchicalParser(resolver)
    const mainFile = sampleNetwork.find((f) => f.name === 'main.yaml')
    if (!mainFile) throw new Error('main.yaml not found')
    return (await hp.parse(mainFile.content, '/main.yaml')).graph
  }

  $effect(() => {
    ;(async () => {
      try {
        status = 'Parsing network...'
        const g = await parseSampleNetwork()

        status = 'Computing layout...'
        const { resolved } = await computeNetworkLayout(g)

        graph = { links: g.links }
        layout = resolved
        stats = {
          nodes: resolved.nodes.size,
          links: g.links.length,
          subgraphs: resolved.subgraphs.size,
        }
        status = 'Ready'
      } catch (e) {
        status = `Error: ${e instanceof Error ? e.message : String(e)}`
      }
    })()
  })

  // =========================================================================
  // Serialization
  // =========================================================================

  function mapToObj(l: ResolvedLayout) {
    return {
      nodes: Object.fromEntries(new Map(l.nodes)),
      ports: Object.fromEntries(new Map(l.ports)),
      edges: Object.fromEntries(new Map(l.edges)),
      subgraphs: Object.fromEntries(new Map(l.subgraphs)),
      bounds: { ...l.bounds },
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: JSON deserialization
  function objToMap(data: any): ResolvedLayout {
    return {
      nodes: new Map(Object.entries(data.nodes ?? {})),
      ports: new Map(Object.entries(data.ports ?? {})),
      edges: new Map(Object.entries(data.edges ?? {})),
      subgraphs: new Map(Object.entries(data.subgraphs ?? {})),
      bounds: data.bounds ?? { x: 0, y: 0, width: 800, height: 600 },
    } as ResolvedLayout
  }

  // =========================================================================
  // Handlers
  // =========================================================================

  function handleSave() {
    const snap = renderer?.getSnapshot()
    if (!snap) return
    const data = JSON.stringify({ layout: mapToObj(snap.layout), links: snap.links }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
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
      const text = await file.text()
      const data = JSON.parse(text)
      const loaded = objToMap(data.layout)
      graph = { links: data.links ?? [] }
      layout = loaded
      stats = {
        nodes: loaded.nodes.size,
        links: data.links?.length ?? 0,
        subgraphs: loaded.subgraphs.size,
      }
    }
    input.click()
  }

  function handleAddNode() {
    renderer?.addNewNode()
    stats = { ...stats, nodes: stats.nodes + 1 }
  }

  function handleAddSubgraph() {
    renderer?.addNewSubgraph()
    stats = { ...stats, subgraphs: stats.subgraphs + 1 }
  }
</script>

<!-- Full-screen canvas with floating island UI -->
<div class="relative h-screen w-screen overflow-hidden bg-neutral-50 dark:bg-neutral-950">
  <!-- Canvas -->
  {#if layout}
    <ShumokuRenderer
      bind:this={renderer}
      {layout}
      {graph}
      theme={editorState.theme}
      mode={editorState.mode}
      onselect={(id: string | null, type: string | null) => {
        selected = id ? { id, type: type ?? 'node' } : null
      }}
      onchange={(links: Link[]) => {
        stats = { ...stats, links: links.length }
      }}
      onlabeledit={(
        portId: string,
        label: string,
        screenX: number,
        screenY: number,
      ) => {
        labelEdit = { portId, label, x: screenX, y: screenY }
      }}
      oncontextmenu={(
        id: string,
        type: string,
        screenX: number,
        screenY: number,
      ) => {
        contextMenu = { id, type, x: screenX, y: screenY }
      }}
    />
  {:else}
    <div class="flex items-center justify-center h-full text-neutral-400 dark:text-neutral-500">
      {status}
    </div>
  {/if}

  <!-- ===== Floating Islands ===== -->

  <div class="absolute top-4 left-4 z-20"><AppTitle /></div>

  <div class="absolute top-4 right-4 z-20">
    <ExportMenu onsave={handleSave} onload={handleLoad} />
  </div>

  <div class="absolute right-4 top-1/2 -translate-y-1/2 z-20">
    <SideToolbar
      mode={editorState.mode}
      isDark={editorState.isDark}
      onmodechange={(m) => {
        editorState.mode = m
      }}
      onaddnode={handleAddNode}
      onaddsubgraph={handleAddSubgraph}
      onthemetoggle={() => editorState.toggleTheme()}
    />
  </div>

  <div class="absolute bottom-4 left-4 z-20"><StatusBadge {status} {stats} {selected} /></div>

  <div class="absolute bottom-4 left-1/2 -translate-x-1/2 z-20"><SheetBar /></div>

  <!-- ===== Overlays ===== -->

  {#if labelEdit}
    <LabelEditPopover
      portId={labelEdit.portId}
      label={labelEdit.label}
      x={labelEdit.x}
      y={labelEdit.y}
      oncommit={(portId, value) => renderer?.commitLabel(portId, value)}
      onclose={() => {
        labelEdit = null
      }}
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
        clipboard = info
          ? {
              label: info.label,
              shape: info.kind === 'node' ? info.shape : undefined,
              type: info.kind === 'node' ? info.type : undefined,
              elementKind: info.kind,
            }
          : null
      }}
      onpaste={() => {
        if (!clipboard || !contextMenu) return
        const svgPos = renderer?.screenToSvg(contextMenu.x, contextMenu.y)
        if (clipboard.elementKind === 'subgraph') {
          renderer?.addNewSubgraph({
            label: clipboard.label,
            position: svgPos,
          })
          stats = { ...stats, subgraphs: stats.subgraphs + 1 }
        } else {
          renderer?.addNewNode({
            label: clipboard.label,
            type: clipboard.type,
            shape: clipboard.shape,
            position: svgPos,
          })
          stats = { ...stats, nodes: stats.nodes + 1 }
        }
      }}
      ondetails={(id) => {
        detailData = renderer?.getElementDetails(id) ?? null
      }}
      ondelete={(id) => {
        renderer?.deleteById(id)
        stats = { ...stats, nodes: Math.max(0, stats.nodes - 1) }
      }}
      onclose={() => {
        contextMenu = null
      }}
    />
  {/if}

  <DetailPanel open={detailData !== null} data={detailData} onclose={() => { detailData = null }} />
</div>
