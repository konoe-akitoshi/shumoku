<script lang="ts">
  import {
    cableVariantsForPlug,
    type EthernetStandard,
    groupCableVariants,
    type PortConnector,
  } from '@shumoku/core'

  let {
    cage,
    standard,
    onchange,
    class: className = '',
    disabled = false,
    placeholder = '— pick module —',
  }: {
    cage?: PortConnector
    standard: EthernetStandard | undefined
    onchange: (v: EthernetStandard | undefined) => void
    class?: string
    disabled?: boolean
    placeholder?: string
  } = $props()

  // The port's cage determines which modules can plug in. We reuse
  // `cableVariantsForPlug` (which lists every standard sharing a cage)
  // and group by medium so the dropdown surfaces the natural sections.
  const variants = $derived(
    cage ? cableVariantsForPlug({ id: cage, cage, label: cage.toUpperCase() }) : [],
  )
  const groups = $derived(groupCableVariants(variants))
</script>

<select
  class={className}
  {disabled}
  value={standard ?? ''}
  onchange={(e) => {
    const v = (e.target as HTMLSelectElement).value
    onchange((v || undefined) as EthernetStandard | undefined)
  }}
>
  <option value="">{placeholder}</option>
  {#each groups as group}
    <optgroup label={group.label}>
      {#each group.variants as v}
        <option value={v.standard}>{v.label}</option>
      {/each}
    </optgroup>
  {/each}
</select>
