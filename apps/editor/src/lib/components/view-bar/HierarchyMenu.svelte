<script lang="ts">
  import { DropdownMenu } from 'bits-ui'
  import { MapPin } from 'phosphor-svelte'

  // Shared dropdown body for the View bar segments. Both Diagram (sheet
  // picker) and Scene (per-subgraph view picker) navigate the same
  // hierarchy — extracting the menu rendering keeps them consistent and
  // avoids drift in styling/indent/active behavior.
  export interface Entry {
    /** `null` represents the implicit Root entry. */
    id: string | null
    label: string
    /** Indent depth (0 = root, 1 = top-level subgraph, …). */
    indent?: number
    /** Show the floor-plan pin icon (used by the Scene segment to
     *  visually distinguish entries that materialize a scene view). */
    showPin?: boolean
  }

  let {
    entries,
    isActive,
    onselect,
  }: {
    entries: Entry[]
    isActive: (id: string | null) => boolean
    onselect: (id: string | null) => void
  } = $props()
</script>

{#each entries as entry (entry.id ?? '__root__')}
  {@const active = isActive(entry.id)}
  <DropdownMenu.Item
    class="cursor-pointer rounded-md px-2 py-1.5 text-xs hover:bg-neutral-100 data-[highlighted]:bg-neutral-100 dark:hover:bg-neutral-700 dark:data-[highlighted]:bg-neutral-700/60 {active
      ? 'font-semibold text-blue-700 dark:text-blue-300'
      : 'text-neutral-700 dark:text-neutral-200'}"
    onclick={() => onselect(entry.id)}
  >
    <span class="flex items-center gap-1.5" style="padding-left: {(entry.indent ?? 0) * 14}px">
      {#if entry.showPin}
        <MapPin class="h-3 w-3 text-amber-500" />
      {/if}
      <span class="block truncate">{entry.label}</span>
    </span>
  </DropdownMenu.Item>
{/each}
