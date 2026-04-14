<script lang="ts">
  import {
    computeNetworkLayout,
    createMemoryFileResolver,
    darkTheme,
    HierarchicalParser,
    type Link,
    lightTheme,
    type ResolvedLayout,
    sampleNetwork,
    type Theme,
  } from '@shumoku/core'
  // @ts-expect-error — SvelteKit resolves the svelte condition from package.json exports
  import ShumokuRenderer from '@shumoku/renderer/components/ShumokuRenderer.svelte'
  import LabelEditPopover from '$lib/components/LabelEditPopover.svelte'
  import NodeContextMenu from '$lib/components/NodeContextMenu.svelte'
  import Toolbar from '$lib/components/Toolbar.svelte'

  // --- State ---

  let renderer: ShumokuRenderer | undefined = $state()
  let status = $state('Loading...')
  let mode = $state<'edit' | 'view'>('view')
  let selected = $state<{ id: string; type: string } | null>(null)
  let contextMenu = $state<{ id: string; type: string; x: number; y: number } | null>(null)
  let stats = $state({ nodes: 0, links: 0, subgraphs: 0 })
  let layout = $state<ResolvedLayout | undefined>(undefined)
  let graph = $state<{ links: Link[] } | undefined>(undefined)
  let isDark = $state(false)
  let labelEdit = $state<{ portId: string; label: string; x: number; y: number } | null>(null)

  const theme: Theme | undefined = $derived(isDark ? darkTheme : lightTheme)

  // --- Dark mode detection ---

  $effect(() => {
    isDark = document.documentElement.classList.contains('dark')
    const obs = new MutationObserver(() => {
      isDark = document.documentElement.classList.contains('dark')
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  })

  // --- Init ---

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

  // --- Serialization ---

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

  // --- Handlers ---

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

<div class="flex flex-col h-screen">
  <Toolbar
    {mode}
    {stats}
    {selected}
    {status}
    onmodechange={(m) => { mode = m }}
    onaddnode={handleAddNode}
    onaddsubgraph={handleAddSubgraph}
    onsave={handleSave}
    onload={handleLoad}
  />

  <div class="flex-1 overflow-hidden relative">
    {#if layout}
      <ShumokuRenderer
        bind:this={renderer}
        {layout}
        {graph}
        {theme}
        {mode}
        onselect={(id: string | null, type: string | null) => { selected = id ? { id, type: type ?? 'node' } : null }}
        onchange={(links: Link[]) => { stats = { ...stats, links: links.length } }}
        onlabeledit={(portId: string, label: string, screenX: number, screenY: number) => {
          labelEdit = { portId, label, x: screenX, y: screenY }
        }}
        oncontextmenu={(id: string, type: string, screenX: number, screenY: number) => {
          contextMenu = { id, type, x: screenX, y: screenY }
        }}
      />
    {:else}
      <div class="flex items-center justify-center h-full text-slate-500 dark:text-neutral-400">
        {status}
      </div>
    {/if}

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
        ondelete={(id) => {
          renderer?.deleteById(id)
          stats = { ...stats, nodes: Math.max(0, stats.nodes - 1) }
        }}
        onduplicate={(_id, type) => {
          if (type === 'node') renderer?.addNewNode()
          else if (type === 'subgraph') renderer?.addNewSubgraph()
        }}
        onclose={() => { contextMenu = null }}
      />
    {/if}
  </div>
</div>
