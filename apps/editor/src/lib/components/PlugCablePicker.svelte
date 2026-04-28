<script lang="ts">
  import {
    cableVariantsForPlug,
    type EthernetStandard,
    plugProfileForStandard,
    plugProfilesForCages,
  } from '@shumoku/core'

  let {
    value,
    fromCage,
    toCage,
    onchange,
    class: className = '',
    disabled = false,
  }: {
    value: EthernetStandard | undefined
    fromCage?: string
    toCage?: string
    onchange: (v: EthernetStandard | undefined) => void
    class?: string
    disabled?: boolean
  } = $props()

  // Step 1: derive the plug profile from the current standard, fall back
  // to the first profile compatible with both port cages so the cable
  // select isn't empty when the link has no standard yet.
  const plugs = $derived(plugProfilesForCages(fromCage, toCage))
  const currentPlug = $derived(plugProfileForStandard(value) ?? plugs[0])

  // Step 2: cable variants live within a plug profile. Only standards
  // matching the picked plug's (cage, speed) appear here.
  const cables = $derived(currentPlug ? cableVariantsForPlug(currentPlug) : [])

  function onPlugSelect(plugId: string) {
    const next = plugs.find((p) => p.id === plugId)
    if (!next) return
    // Switching plug: default to the first cable variant under the new
    // plug so the standard stays valid.
    const variants = cableVariantsForPlug(next)
    onchange(variants[0]?.standard)
  }

  function onCableSelect(standard: string) {
    onchange((standard || undefined) as EthernetStandard | undefined)
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
    {:else if !value}
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
    value={value ?? ''}
    onchange={(e) => onCableSelect((e.target as HTMLSelectElement).value)}
  >
    {#if cables.length === 0}
      <option value="" disabled>— pick a plug first —</option>
    {:else if !value}
      <option value="">— pick a cable —</option>
    {/if}
    {#each cables as cable}
      <option value={cable.standard}>{cable.label}</option>
    {/each}
  </select>
</div>
