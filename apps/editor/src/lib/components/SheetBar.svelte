<script lang="ts">
  import { DropdownMenu } from 'bits-ui'
  import { CaretDown, Stack } from 'phosphor-svelte'
  import { diagramState } from '$lib/context.svelte'

  // Hierarchy drill-down: Root + each top-level subgraph. Conceptually
  // this is "go deeper into this part of the diagram", not "switch to a
  // different scene" — so we present it as a single trigger with a
  // toggle-down menu rather than a row of parallel tabs.
  const sheets = $derived(diagramState.availableSheets)
  const activeId = $derived(diagramState.currentSheetId)
  const activeLabel = $derived(sheets.find((s) => s.id === activeId)?.label ?? 'Root')
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-lg backdrop-blur-sm hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/90 dark:text-neutral-200 dark:hover:bg-neutral-700/60"
        title="Hierarchy"
        {...props}
      >
        <Stack class="h-3.5 w-3.5 text-neutral-500" />
        <span class="max-w-[180px] truncate">{activeLabel}</span>
        <CaretDown class="h-3 w-3 text-neutral-400" />
      </button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content
    align="center"
    sideOffset={6}
    class="z-50 min-w-[200px] rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
  >
    {#each sheets as sheet (sheet.id ?? '__root__')}
      {@const isActive = sheet.id === activeId}
      {@const indent = sheet.id === null ? 0 : 1}
      <DropdownMenu.Item
        class="cursor-pointer rounded-md px-2 py-1.5 text-xs hover:bg-neutral-100 data-[highlighted]:bg-neutral-100 dark:hover:bg-neutral-700 dark:data-[highlighted]:bg-neutral-700/60 {isActive
          ? 'font-semibold text-blue-700 dark:text-blue-300'
          : 'text-neutral-700 dark:text-neutral-200'}"
        onclick={() => diagramState.switchSheet(sheet.id)}
      >
        <span style="padding-left: {indent * 14}px" class="block truncate"> {sheet.label} </span>
      </DropdownMenu.Item>
    {/each}
  </DropdownMenu.Content>
</DropdownMenu.Root>
