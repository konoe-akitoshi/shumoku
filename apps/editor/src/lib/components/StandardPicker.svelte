<script lang="ts">
  import { type EthernetStandard, groupStandards, standardsForCages } from '@shumoku/core'

  let {
    value,
    fromCage,
    toCage,
    onchange,
    placeholder = '— pick a standard —',
    class: className = '',
    disabled = false,
  }: {
    value: EthernetStandard | undefined
    fromCage?: string
    toCage?: string
    onchange: (v: EthernetStandard | undefined) => void
    placeholder?: string
    class?: string
    disabled?: boolean
  } = $props()

  // Filter the registry by both cages and bucket by cable kind. Unknown
  // cages → fully permissive (the user might be authoring before binding
  // catalog data). The select shows only physically-fitting standards.
  const groups = $derived(groupStandards(standardsForCages(fromCage, toCage)))

  // If the current value isn't representable in the filtered list (e.g. a
  // custom string typed before, or cages narrowed the list), keep it
  // visible as a "custom" option so we don't silently drop it.
  const valueInGroups = $derived(
    !value || groups.some((g) => g.options.some((o) => o.name === value)),
  )
</script>

<select
  class={className}
  value={value ?? ''}
  {disabled}
  onchange={(e) => {
    const v = (e.target as HTMLSelectElement).value
    onchange((v || undefined) as EthernetStandard | undefined)
  }}
>
  <option value="">{placeholder}</option>
  {#if !valueInGroups && value}
    <option {value}>{value} (custom)</option>
  {/if}
  {#each groups as group}
    <optgroup label={group.label}>
      {#each group.options as opt}
        <option value={opt.name}>{opt.label}</option>
      {/each}
    </optgroup>
  {/each}
</select>
