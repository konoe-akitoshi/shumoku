<script lang="ts">
  import type { CableGrade } from '@shumoku/core'
  import { Panel } from '@xyflow/svelte'
  import { Button } from '$lib/components/ui/button'
  import { CABLE_GRADE_ORDER, cableCategoryColor, cableGradeLabel } from '$lib/scene/cable-colors'

  // In-canvas color legend for scene wires. The wire stroke palette
  // lives in `cable-colors.ts`; this component is the visual readout
  // for it. Lists only the grades actually present in the scene so
  // the legend reflects what the user is looking at — a 3-link
  // scene with one Cat 6 and two OM3 wires shows two rows, not
  // twelve. Empty when no link has a `cable.category` set, so we
  // don't introduce UI noise on scenes that haven't been categorized.
  //
  // Positioning is Svelte Flow `<Panel>` (canvas-fixed, opts out of
  // viewport zoom/pan). Inner styling is shadcn-svelte so the legend
  // matches the rest of the app (NavBar / modals / detail panels).
  // Mixing the two is the standard Svelte-Flow-plus-UI-library
  // pattern — Panel for "where", shadcn for "how it looks".

  type Props = {
    /** Cable grades referenced by visible links in the current scene.
     *  Caller passes the deduped set; legend filters + sorts. */
    presentGrades: Iterable<CableGrade>
  }

  const { presentGrades }: Props = $props()

  // Open state is local — there's no project-wide setting to persist
  // because the legend is informational, not a configuration. Default
  // closed so the canvas reads uncluttered; one click reveals the key.
  let expanded = $state(false)

  const sortedGrades = $derived.by(() => {
    const present = new Set(presentGrades)
    return CABLE_GRADE_ORDER.filter((g) => present.has(g))
  })
</script>

{#if sortedGrades.length > 0}
  <Panel position="bottom-right">
    {#if expanded}
      <div
        class="flex w-44 flex-col rounded-md border border-neutral-200 bg-white text-slate-800 shadow-md dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
      >
        <div
          class="flex items-center justify-between border-b border-neutral-200 px-3 py-1.5 text-[11px] font-medium dark:border-neutral-700"
        >
          <span>Cable colors</span>
          <Button
            variant="ghost"
            size="icon"
            class="h-5 w-5 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            onclick={() => {
              expanded = false
            }}
            aria-label="Close cable color legend"
          >
            ×
          </Button>
        </div>
        <ul class="flex flex-col gap-1 px-3 py-2">
          {#each sortedGrades as grade (grade)}
            <li class="flex items-center gap-2 text-[11px]">
              <span
                class="inline-block h-2 w-4 flex-shrink-0 rounded-sm"
                style="background: {cableCategoryColor(grade)};"
                aria-hidden="true"
              ></span>
              <span>{cableGradeLabel(grade)}</span>
            </li>
          {/each}
        </ul>
      </div>
    {:else}
      <Button
        variant="outline"
        size="sm"
        class="h-7 px-2 text-[11px]"
        onclick={() => {
          expanded = true
        }}
      >
        Cable colors
      </Button>
    {/if}
  </Panel>
{/if}
