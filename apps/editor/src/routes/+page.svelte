<script lang="ts">
  import {
    computeNetworkLayout,
    createMemoryFileResolver,
    HierarchicalParser,
    type Link,
    type ResolvedEdge,
    type ResolvedLayout,
    type ResolvedNode,
    type ResolvedPort,
    type ResolvedSubgraph,
    sampleNetwork,
  } from '@shumoku/core'
  // @ts-expect-error — SvelteKit resolves the svelte condition from package.json exports
  import ShumokuRenderer from '@shumoku/renderer/components/ShumokuRenderer.svelte'
  import AppTitle from '$lib/components/AppTitle.svelte'
  import CodePanel from '$lib/components/CodePanel.svelte'
  import DetailPanel from '$lib/components/DetailPanel.svelte'
  import ExportMenu from '$lib/components/ExportMenu.svelte'
  import LabelEditPopover from '$lib/components/LabelEditPopover.svelte'
  import NodeContextMenu from '$lib/components/NodeContextMenu.svelte'
  import SheetBar from '$lib/components/SheetBar.svelte'
  import SideToolbar from '$lib/components/SideToolbar.svelte'
  import StatusBadge from '$lib/components/StatusBadge.svelte'
  import { editorState, initDarkMode } from '$lib/context.svelte'

  // =========================================================================
  // Layout state — THE source of truth
  // =========================================================================

  let nodes = $state<Map<string, ResolvedNode>>(new Map())
  let ports = $state<Map<string, ResolvedPort>>(new Map())
  let edges = $state<Map<string, ResolvedEdge>>(new Map())
  let subgraphs = $state<Map<string, ResolvedSubgraph>>(new Map())
  let bounds = $state({ x: 0, y: 0, width: 0, height: 0 })
  let links = $state<Link[]>([])

  // =========================================================================
  // UI state
  // =========================================================================

  let renderer: ShumokuRenderer | undefined = $state()
  let status = $state('Loading...')
  let codePanelOpen = $state(false)
  let yamlSource = $state('')
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
  // Derived
  // =========================================================================

  const stats = $derived({ nodes: nodes.size, links: links.length, subgraphs: subgraphs.size })
  let jsonSource = $state('{}')
  $effect(() => {
    jsonSource = stateToJson()
  })

  // =========================================================================
  // Serialization
  // =========================================================================

  function stateToJson(): string {
    return JSON.stringify(
      {
        layout: {
          nodes: Object.fromEntries(new Map(nodes)),
          ports: Object.fromEntries(new Map(ports)),
          edges: Object.fromEntries(new Map(edges)),
          subgraphs: Object.fromEntries(new Map(subgraphs)),
          bounds: { ...bounds },
        },
        links: [...links],
      },
      null,
      2,
    )
  }

  function loadFromJson(jsonStr: string) {
    const data = JSON.parse(jsonStr)
    nodes = new Map(Object.entries(data.layout?.nodes ?? {})) as Map<string, ResolvedNode>
    ports = new Map(Object.entries(data.layout?.ports ?? {})) as Map<string, ResolvedPort>
    edges = new Map(Object.entries(data.layout?.edges ?? {})) as Map<string, ResolvedEdge>
    subgraphs = new Map(Object.entries(data.layout?.subgraphs ?? {})) as Map<
      string,
      ResolvedSubgraph
    >
    bounds = data.layout?.bounds ?? { x: 0, y: 0, width: 800, height: 600 }
    links = data.links ?? []
  }

  function loadFromResolved(resolved: ResolvedLayout, graphLinks: Link[]) {
    nodes = new Map(resolved.nodes)
    ports = new Map(resolved.ports)
    edges = new Map(resolved.edges)
    subgraphs = new Map(resolved.subgraphs)
    bounds = resolved.bounds
    links = [...graphLinks]
  }

  // =========================================================================
  // Init
  // =========================================================================

  $effect(() => {
    return initDarkMode()
  })

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
        loadFromResolved(resolved, g.links)
        const mainFile = sampleNetwork.find((f) => f.name === 'main.yaml')
        if (mainFile) yamlSource = mainFile.content
        status = 'Ready'
      } catch (e) {
        status = `Error: ${e instanceof Error ? e.message : String(e)}`
      }
    })()
  })

  // =========================================================================
  // Apply
  // =========================================================================

  async function applyYaml(yamlStr: string) {
    try {
      status = 'Parsing YAML...'
      const fileMap = new Map<string, string>()
      fileMap.set('main.yaml', yamlStr)
      fileMap.set('./main.yaml', yamlStr)
      fileMap.set('/main.yaml', yamlStr)
      const resolver = createMemoryFileResolver(fileMap, '/')
      const hp = new HierarchicalParser(resolver)
      const { graph: g } = await hp.parse(yamlStr, '/main.yaml')
      const { resolved } = await computeNetworkLayout(g)
      loadFromResolved(resolved, g.links)
      status = 'Ready'
    } catch (_e) {
      status = 'YAML parse error'
    }
  }

  function applyJson(jsonStr: string) {
    try {
      loadFromJson(jsonStr)
      status = 'Ready'
    } catch (_e) {
      status = 'JSON parse error'
    }
  }

  // =========================================================================
  // File
  // =========================================================================

  function handleSave() {
    const blob = new Blob([stateToJson()], { type: 'application/json' })
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

<!--
  Canvas = full screen, always.
  UI = fixed overlays, each owns its corner.
  They don't know about each other. Overlap is fine (same as Miro/Figma).
-->
<div class="relative h-screen w-screen overflow-hidden bg-neutral-50 dark:bg-neutral-950">
  <!-- Canvas (full screen, z-0) -->
  <div class="absolute inset-0">
    {#if nodes.size > 0 || status !== 'Loading...'}
      <ShumokuRenderer
        bind:this={renderer}
        bind:nodes
        bind:ports
        bind:edges
        bind:subgraphs
        bind:bounds
        bind:links
        theme={editorState.theme}
        mode={editorState.mode}
        onselect={(id: string | null, type: string | null) => { selected = id ? { id, type: type ?? 'node' } : null }}
        onchange={() => {}}
        onlabeledit={(portId: string, label: string, screenX: number, screenY: number) => { labelEdit = { portId, label, x: screenX, y: screenY } }}
        oncontextmenu={(id: string, type: string, screenX: number, screenY: number) => { contextMenu = { id, type, x: screenX, y: screenY } }}
      />
    {:else}
      <div class="flex items-center justify-center h-full text-neutral-400 dark:text-neutral-500">
        {status}
      </div>
    {/if}
  </div>

  <!-- Top-left: Title -->
  <div class="fixed top-3 left-3 z-20"><AppTitle /></div>

  <!-- Top-right: Export -->
  <div class="fixed top-3 right-3 z-20"><ExportMenu onsave={handleSave} onload={handleLoad} /></div>

  <!-- Left: Code panel (above other islands) -->
  <div class="fixed top-3 bottom-3 left-3 z-30">
    <CodePanel
      open={codePanelOpen}
      yaml={yamlSource}
      json={jsonSource}
      ontoggle={() => { codePanelOpen = !codePanelOpen }}
      onyamlchange={(v) => { yamlSource = v }}
      onjsonchange={(v) => { jsonSource = v }}
      onyamlapply={() => applyYaml(yamlSource)}
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
  <div class="fixed bottom-3 left-3 z-20"><StatusBadge {status} {stats} {selected} /></div>

  <!-- Bottom-center: Sheet bar -->
  <div class="fixed bottom-3 left-1/2 -translate-x-1/2 z-20"><SheetBar /></div>

  <!-- Overlays (cursor-positioned) -->

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

  <DetailPanel open={detailData !== null} data={detailData} onclose={() => { detailData = null }} />
</div>
