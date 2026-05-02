<script lang="ts">
  import {
    cableVariantsForPlug,
    type EthernetStandard,
    groupCableVariants,
    type PortConnector,
    plugProfileForStandard,
    plugProfilesForCages,
  } from '@shumoku/core'

  let {
    cage,
    standard,
    onchange,
    class: className = '',
    disabled = false,
  }: {
    cage?: PortConnector
    standard: EthernetStandard | undefined
    onchange: (v: EthernetStandard | undefined) => void
    class?: string
    disabled?: boolean
  } = $props()

  // Plug = cable-side form factor (RJ45, SFP, SFP+, …). The user picks
  // it explicitly so the module list stays narrow. When the port carries
  // a cage (catalog-known), it pins the plug — otherwise the user picks
  // freely and we fall back to all known plugs.
  const plugOptions = $derived(plugProfilesForCages(cage, undefined))

  // Local UI state for the plug select when neither cage nor module
  // implies a plug yet (fresh row, nothing picked).
  let userPlug = $state<string>('')

  // Effective plug priority: port cage (hardware constraint) > module's
  // implied plug > user explicit pick. Cage wins when both cage and
  // module disagree because the port can't host an incompatible module.
  const effectivePlug = $derived.by<string | undefined>(() => {
    if (cage) return cage
    return plugProfileForStandard(standard)?.cage ?? userPlug ?? undefined
  })

  const variants = $derived(
    effectivePlug
      ? cableVariantsForPlug({
          id: effectivePlug,
          cage: effectivePlug as PortConnector,
          label: effectivePlug.toUpperCase(),
        })
      : [],
  )
  const groups = $derived(groupCableVariants(variants))

  // Cage-locked: the port hardware forces the plug, so disable the select
  // (it would only ever show the same value).
  const plugLocked = $derived(Boolean(cage))

  function onPlugChange(value: string) {
    userPlug = value
    // If the current module's required plug doesn't match the new pick,
    // clear it — the user is picking a different form factor and the
    // module list will refilter.
    const stdPlug = plugProfileForStandard(standard)?.cage
    if (standard && stdPlug !== value) onchange(undefined)
  }
</script>

<div class="flex flex-col gap-1">
  <select
    class={className}
    disabled={disabled || plugLocked}
    value={effectivePlug ?? ''}
    onchange={(e) => onPlugChange((e.target as HTMLSelectElement).value)}
  >
    <option value="">— plug —</option>
    {#each plugOptions as p}
      <option value={p.cage}>{p.label}</option>
    {/each}
  </select>
  <select
    class={className}
    disabled={disabled || !effectivePlug}
    value={standard ?? ''}
    onchange={(e) => {
      const v = (e.target as HTMLSelectElement).value
      onchange((v || undefined) as EthernetStandard | undefined)
    }}
  >
    <option value="">— module —</option>
    {#each groups as group}
      <optgroup label={group.label}>
        {#each group.variants as v}
          <option value={v.standard}>{v.label}</option>
        {/each}
      </optgroup>
    {/each}
  </select>
</div>
