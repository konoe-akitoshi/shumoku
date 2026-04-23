<script lang="ts">
  import { diagramState } from '$lib/context.svelte'

  // Show the root sheet plus one tab per top-level subgraph. Sheet
  // state is tracked in diagramState; Layer 0 only updates the state
  // on click — visual filtering of the diagram is a follow-up once
  // the renderer supports pure-view mode.
  const sheets = $derived(diagramState.availableSheets)
  const activeId = $derived(diagramState.currentSheetId)
</script>

<div
  class="flex items-center gap-1 px-2 py-1.5 bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-lg"
>
  {#each sheets as sheet (sheet.id ?? '__root__')}
    {@const isActive = sheet.id === activeId}
    <button
      type="button"
      class="px-3 py-1 text-xs font-medium rounded-md transition-colors max-w-[160px] truncate
        {isActive
        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
        : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'}"
      title={sheet.label}
      onclick={() => diagramState.switchSheet(sheet.id)}
    >
      {sheet.label}
    </button>
  {/each}
</div>
