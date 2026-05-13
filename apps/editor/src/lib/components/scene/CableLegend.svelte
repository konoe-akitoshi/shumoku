<script lang="ts">
  import type { CableGrade } from '@shumoku/core'
  import { Panel } from '@xyflow/svelte'
  import { CABLE_GRADE_ORDER, cableCategoryColor, cableGradeLabel } from '$lib/scene/cable-colors'

  // In-canvas color legend for scene wires. The wire stroke palette
  // lives in `cable-colors.ts`; this component is the visual readout
  // for it. Always expanded, always filtered: shows just the grades
  // referenced by links in the current scene, and hides entirely
  // when no link has a `cable.category` set — the legend follows the
  // data, no toggling, no reference mode.
  //
  // Positioning is Svelte Flow `<Panel>` (canvas-fixed, opts out of
  // viewport zoom/pan). Inner styling is plain Tailwind so the card
  // matches the rest of the app (NavBar / modals / detail panels).

  type Props = {
    /** Cable grades referenced by visible links in the current scene. */
    presentGrades: Iterable<CableGrade>
  }

  const { presentGrades }: Props = $props()

  const sortedGrades = $derived.by(() => {
    const present = new Set(presentGrades)
    return CABLE_GRADE_ORDER.filter((g) => present.has(g))
  })
</script>

{#if sortedGrades.length > 0}
  <Panel position="bottom-right">
    <div
      class="flex flex-col rounded-md border border-neutral-200 bg-white text-slate-800 shadow-md dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
    >
      <div
        class="border-b border-neutral-200 px-3 py-1.5 text-[11px] font-medium dark:border-neutral-700"
      >
        Cable colors
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
  </Panel>
{/if}
