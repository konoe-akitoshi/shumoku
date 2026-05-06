<script lang="ts">
  import { DropdownMenu } from 'bits-ui'
  import { CaretDown, MapPin } from 'phosphor-svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { diagramState } from '$lib/context.svelte'
  import { isPhysicalSubgraph } from '$lib/scene/scope'
  import HierarchyMenu, { type Entry } from './HierarchyMenu.svelte'
  import { segmentClass } from './segment'

  let { active = false }: { active?: boolean } = $props()

  // Scenes mirror subgraphs 1:1 — every (physical) subgraph implicitly
  // has a scene view. The Scene record materializes lazily on first
  // access, same shape of nav as the Diagram-side sheet picker.
  const currentSceneId = $derived(diagramState.currentSceneId)
  const current = $derived(diagramState.currentScene)
  const subgraphs = $derived([...diagramState.subgraphs.values()])
  const topLevelSubgraphs = $derived(subgraphs.filter((sg) => !sg.parent))

  const triggerLabel = $derived.by(() => {
    if (currentSceneId === null || !current) return 'Scene'
    const scope = current.scopeSubgraphId
    const parentLabel = scope ? (subgraphs.find((sg) => sg.id === scope)?.label ?? null) : null
    return parentLabel ?? current.name
  })

  // Same shape of entries as SheetSegment — Root + each top-level
  // subgraph — filtered to physical (logical subgraphs can't host a
  // floor plan).
  const entries = $derived<Entry[]>([
    { id: null, label: 'Root', indent: 0, showPin: true },
    ...topLevelSubgraphs
      .filter(isPhysicalSubgraph)
      .map((sg) => ({ id: sg.id, label: sg.label, indent: 1, showPin: true })),
  ])

  function isActive(id: string | null): boolean {
    if (currentSceneId === null) return false
    const scope = current?.scopeSubgraphId
    return id === null ? scope === undefined : scope === id
  }

  function selectScene(id: string | null) {
    diagramState.setCurrentSceneForScope(id ?? undefined)
    // Persist scope to URL so a reload returns to the same scene
    // instead of dumping the user back to the diagram view.
    //   id === null   → ?scope=  (empty value = root scene)
    //   id === '<sg>' → ?scope=<sg>
    const url = new URL($page.url)
    url.searchParams.set('scope', id ?? '')
    goto(`${url.pathname}${url.search}`, { replaceState: true, keepFocus: true })
  }
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <button type="button" class={segmentClass(active)} title="Scene" {...props}>
        <MapPin class="h-3.5 w-3.5 text-amber-500" />
        <span class="max-w-[180px] truncate">{triggerLabel}</span>
        <CaretDown class="h-3 w-3 text-neutral-400" />
      </button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content
    align="center"
    sideOffset={6}
    class="z-50 min-w-[200px] rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
  >
    <HierarchyMenu {entries} {isActive} onselect={selectScene} />
  </DropdownMenu.Content>
</DropdownMenu.Root>
