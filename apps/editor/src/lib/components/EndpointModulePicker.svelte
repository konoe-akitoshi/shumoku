<script lang="ts">
  import {
    cableVariantsForPlug,
    type EthernetStandard,
    groupCableVariants,
    type PortConnector,
    plugProfileForStandard,
    plugProfilesForConnectors,
  } from '@shumoku/core'

  let {
    connectors,
    standard,
    onchange,
    class: className = '',
    disabled = false,
  }: {
    /** Physical receptacles on the port. Length 1 = single connector;
     * length ≥ 2 = combo (user picks which receptacle to use). Undefined
     * or empty = unknown (offer all plug options). */
    connectors?: PortConnector[]
    standard: EthernetStandard | undefined
    onchange: (v: EthernetStandard | undefined) => void
    class?: string
    disabled?: boolean
  } = $props()

  // Plug = cable-side form factor. We constrain the dropdown to plugs
  // that fit at least one of the port's connectors. Empty list =
  // permissive (all plugs).
  const plugOptions = $derived(plugProfilesForConnectors(connectors, undefined))

  // Local UI state for the plug select when neither connectors nor module
  // implies a plug yet (fresh row, nothing picked).
  let userPlug = $state<string>('')

  // Effective plug priority for non-combo ports: port's single connector
  // pins the plug. For combo ports, fall through to the module's implied
  // plug or the user's explicit pick — they have to choose physically.
  const effectivePlug = $derived.by<string | undefined>(() => {
    if (connectors && connectors.length === 1) return connectors[0]
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

  // Plug locked when the port has a single connector — the hardware
  // forces the plug, so the select would only ever show one value.
  // Combo ports (≥ 2 connectors) leave the user to choose.
  const plugLocked = $derived(connectors?.length === 1)

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
