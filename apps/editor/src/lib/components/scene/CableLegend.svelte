<script lang="ts">
  import type { CableGrade } from '@shumoku/core'
  import { Panel } from '@xyflow/svelte'
  import { Button } from '$lib/components/ui/button'
  import { CABLE_GRADE_ORDER, cableCategoryColor, cableGradeLabel } from '$lib/scene/cable-colors'

  // In-canvas color legend for scene wires. The wire stroke palette
  // lives in `cable-colors.ts`; this component is the visual readout
  // for it.
  //
  // - **Categorized scene** (some link has `cable.category`): legend
  //   filters to grades actually used, so a 3-link scene with one
  //   Cat 6 and two OM3 wires shows two rows, not twelve.
  // - **Un-categorized scene** (no link has it set): full 12-grade
  //   palette is shown as a reference card. The legend is the
  //   discovery surface for the color system, so users see what's
  //   possible before they start assigning grades — and don't waste
  //   time hunting for "where do I see the color key".
  //
  // Positioning is Svelte Flow `<Panel>` (canvas-fixed, opts out of
  // viewport zoom/pan). Inner styling is Tailwind + shadcn Button so
  // the legend matches the rest of the app (NavBar / modals / detail
  // panels). Standard "Panel for where, UI library for how it looks".

  type Props = {
    /** Cable grades referenced by visible links in the current scene.
     *  Empty → legend falls back to the full reference set. */
    presentGrades: Iterable<CableGrade>
  }

  const { presentGrades }: Props = $props()

  // Open state is local — there's no project-wide setting to persist
  // because the legend is informational, not a configuration. Default
  // closed so the canvas reads uncluttered; one click reveals the key.
  let expanded = $state(false)

  const isReferenceMode = $derived.by(() => {
    const it = presentGrades[Symbol.iterator]()
    return it.next().done === true
  })
  const sortedGrades = $derived.by(() => {
    if (isReferenceMode) return CABLE_GRADE_ORDER
    const present = new Set(presentGrades)
    return CABLE_GRADE_ORDER.filter((g) => present.has(g))
  })
</script>

<Panel position="bottom-right">
  {#if expanded}
    <div
      class="flex w-44 flex-col rounded-md border border-neutral-200 bg-white text-slate-800 shadow-md dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
    >
      <div
        class="flex items-center justify-between border-b border-neutral-200 px-3 py-1.5 text-[11px] font-medium dark:border-neutral-700"
      >
        <span>
          Cable colors
          {#if isReferenceMode}
            <span class="ml-1 font-normal text-neutral-400 dark:text-neutral-500">
              (reference)
            </span>
          {/if}
        </span>
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
    <button
      type="button"
      class="flex h-7 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2 text-[11px] font-medium text-slate-800 shadow-md hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
      onclick={() => {
        expanded = true
      }}
      aria-label="Show cable color legend"
    >
      <!-- 4 swatch pips so the trigger itself hints at the content -->
      <span class="flex gap-0.5" aria-hidden="true">
        <span class="h-2 w-1 rounded-[1px]" style="background:#2563EB"></span>
        <span class="h-2 w-1 rounded-[1px]" style="background:#10B981"></span>
        <span class="h-2 w-1 rounded-[1px]" style="background:#06B6D4"></span>
        <span class="h-2 w-1 rounded-[1px]" style="background:#EAB308"></span>
      </span>
      Cable colors
    </button>
  {/if}
</Panel>
