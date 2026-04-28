<script lang="ts">
  import {
    cableVariantsForPlug,
    type EthernetStandard,
    groupCableVariants,
    type PortConnector,
    plugProfilesForCages,
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

  // The port's cage determines which modules can plug in. When the cage
  // is set, we constrain the list to that cage's variants. When it isn't
  // (legacy ports without explicit cage info), fall back to listing every
  // known cage's variants so the user is never stuck on an empty dropdown.
  const variants = $derived.by(() => {
    if (cage) return cableVariantsForPlug({ id: cage, cage, label: cage.toUpperCase() })
    return plugProfilesForCages(undefined, undefined).flatMap((p) => cableVariantsForPlug(p))
  })
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
