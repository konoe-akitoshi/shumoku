<script lang="ts">
  import {
    cableGradesForStandard,
    cableVariantsForPlug,
    defaultCableGrade,
    type EthernetStandard,
    plugProfileForStandard,
    plugProfilesForCages,
  } from '@shumoku/core'

  let {
    standard,
    cableCategory,
    fromCage,
    toCage,
    onstandardchange,
    oncategorychange,
    class: className = '',
    disabled = false,
  }: {
    standard: EthernetStandard | undefined
    cableCategory: string | undefined
    fromCage?: string
    toCage?: string
    onstandardchange: (v: EthernetStandard | undefined) => void
    oncategorychange: (v: string | undefined) => void
    class?: string
    disabled?: boolean
  } = $props()

  // Step 1: plug profile = cage + speed (e.g. "SFP+ 10G").
  const plugs = $derived(plugProfilesForCages(fromCage, toCage))
  const currentPlug = $derived(plugProfileForStandard(standard) ?? plugs[0])

  // Step 2: cable variants share the same plug profile but differ by
  // medium kind (MM fiber / SM fiber / DAC / AOC for SFP+ 10G, etc.).
  const cables = $derived(currentPlug ? cableVariantsForPlug(currentPlug) : [])

  // Step 3: media grade — Cat5e/6/6a/8 for twisted-pair, OM3/4/5 for
  // multimode, OS1/2 for single-mode. Empty for DAC/AOC.
  const grades = $derived(cableGradesForStandard(standard))
  const showGrades = $derived(grades.length > 0)

  function onPlugSelect(plugId: string) {
    const next = plugs.find((p) => p.id === plugId)
    if (!next) return
    // Switching plug: default to the first cable variant + its grade so
    // the link spec stays consistent end-to-end.
    const variants = cableVariantsForPlug(next)
    const newStandard = variants[0]?.standard
    onstandardchange(newStandard)
    oncategorychange(defaultCableGrade(newStandard))
  }

  function onCableSelect(value: string) {
    const newStandard = (value || undefined) as EthernetStandard | undefined
    onstandardchange(newStandard)
    // Reset grade to the default for the new cable kind; let the user
    // override afterwards.
    oncategorychange(defaultCableGrade(newStandard))
  }

  function onGradeSelect(value: string) {
    oncategorychange(value || undefined)
  }
</script>

<div class="flex flex-col gap-1">
  <label class="text-[9px] uppercase tracking-wider text-neutral-400">Plug (cage / speed)</label>
  <select
    class={className}
    {disabled}
    value={currentPlug?.id ?? ''}
    onchange={(e) => onPlugSelect((e.target as HTMLSelectElement).value)}
  >
    {#if plugs.length === 0}
      <option value="" disabled>— no compatible plug —</option>
    {:else if !standard}
      <option value="" disabled>— pick a plug —</option>
    {/if}
    {#each plugs as plug}
      <option value={plug.id}>{plug.label}</option>
    {/each}
  </select>

  <label class="mt-1 text-[9px] uppercase tracking-wider text-neutral-400">Cable</label>
  <select
    class={className}
    disabled={disabled || !currentPlug || cables.length === 0}
    value={standard ?? ''}
    onchange={(e) => onCableSelect((e.target as HTMLSelectElement).value)}
  >
    {#if cables.length === 0}
      <option value="" disabled>— pick a plug first —</option>
    {:else if !standard}
      <option value="">— pick a cable —</option>
    {/if}
    {#each cables as cable}
      <option value={cable.standard}>{cable.label}</option>
    {/each}
  </select>

  {#if showGrades}
    <label class="mt-1 text-[9px] uppercase tracking-wider text-neutral-400">Cable grade</label>
    <select
      class={className}
      {disabled}
      value={cableCategory ?? ''}
      onchange={(e) => onGradeSelect((e.target as HTMLSelectElement).value)}
    >
      <option value="">— unspecified —</option>
      {#each grades as g}
        <option value={g.value}>{g.label}</option>
      {/each}
    </select>
  {/if}
</div>
