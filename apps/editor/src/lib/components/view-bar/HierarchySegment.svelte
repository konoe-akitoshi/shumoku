<script lang="ts">
  import { DropdownMenu } from 'bits-ui'
  import { CaretDown, Stack } from 'phosphor-svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { diagramState } from '$lib/context.svelte'
  import HierarchyMenu, { type Entry } from './HierarchyMenu.svelte'
  import { segmentClass } from './segment'

  // Hierarchy is the one place the user picks "which subgraph am I
  // looking at". The Diagram and Scene buttons read that focus and
  // open the appropriate view of it. When a scene is already active,
  // drilling here re-points the scene at the new focus too (keeping
  // the URL's ?scope= in sync).
  let { active = false }: { active?: boolean } = $props()

  const sheets = $derived(diagramState.availableSheets)
  const activeId = $derived(diagramState.currentSheetId)
  const activeSheet = $derived(sheets.find((s) => s.id === activeId)?.label ?? 'Root')

  const entries = $derived<Entry[]>(
    sheets.map((s) => ({ id: s.id, label: s.label, indent: s.id === null ? 0 : 1 })),
  )

  function isActive(id: string | null): boolean {
    return id === activeId
  }

  function selectSheet(id: string | null) {
    diagramState.switchSheet(id)
    if (diagramState.currentSceneId !== null) {
      diagramState.setCurrentSceneForScope(id ?? undefined)
      const url = new URL($page.url)
      url.searchParams.set('scope', id ?? '')
      goto(`${url.pathname}${url.search}`, { replaceState: true, keepFocus: true })
    }
  }
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <button type="button" class={segmentClass(active)} title="Hierarchy" {...props}>
        <Stack class="h-3.5 w-3.5 text-neutral-500" />
        <span class="max-w-[180px] truncate">{activeSheet}</span>
        <CaretDown class="h-3 w-3 text-neutral-400" />
      </button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content
    align="center"
    sideOffset={6}
    class="z-50 min-w-[200px] rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
  >
    <HierarchyMenu {entries} {isActive} onselect={selectSheet} />
  </DropdownMenu.Content>
</DropdownMenu.Root>
