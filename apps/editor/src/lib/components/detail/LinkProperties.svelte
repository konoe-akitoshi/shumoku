<script lang="ts">
  import {
    cableGradesForStandard,
    defaultCableGrade,
    type EthernetStandard,
    endpointStandard,
    type Link,
    type LinkEndpoint,
    type LinkPlug,
    type Node,
    plugFromStandard,
  } from '@shumoku/core'
  import EndpointModulePicker from '$lib/components/EndpointModulePicker.svelte'
  import PortPicker from '$lib/components/PortPicker.svelte'
  import StandardImpliedBlock from '$lib/components/StandardImpliedBlock.svelte'

  let {
    link,
    editing = false,
    nodes = new Map(),
    onupdate,
  }: {
    link: Link
    editing?: boolean
    nodes?: Map<string, Node>
    onupdate?: (updates: Partial<Link>) => void
  } = $props()

  function getEndpoint(ep: LinkEndpoint) {
    return {
      node: ep.node,
      port: ep.port,
      ip: Array.isArray(ep.ip) ? ep.ip.join(', ') : (ep.ip ?? ''),
    }
  }

  const from = $derived(getEndpoint(link.from))
  const to = $derived(getEndpoint(link.to))

  const vlanDisplay = $derived(
    link.vlan ? (Array.isArray(link.vlan) ? link.vlan.join(', ') : String(link.vlan)) : '',
  )

  const labelDisplay = $derived(
    Array.isArray(link.label) ? link.label.join(', ') : (link.label ?? ''),
  )

  const nodeOptions = $derived(
    [...nodes.entries()].map(([id, n]) => ({
      id,
      label: Array.isArray(n.label) ? n.label[0] : (n.label ?? id),
    })),
  )

  function getPortOptions(nodeId: string) {
    return nodes.get(nodeId)?.ports ?? []
  }

  function portOptionLabel(port: NonNullable<Node['ports']>[number]) {
    const label = port.label || port.cage || 'unnamed port'
    const attrs = [
      port.faceplateLabel && port.faceplateLabel !== port.label
        ? `panel ${port.faceplateLabel}`
        : '',
      port.speed,
      port.cage,
      port.poe ? 'PoE' : '',
    ]
      .filter(Boolean)
      .join(', ')
    return attrs ? `${label} (${attrs})` : label
  }

  function displayPort(nodeId: string, portId: string) {
    const port = getPortOptions(nodeId).find((p) => p.id === portId)
    return port ? portOptionLabel(port) : portId
  }

  function updateEndpointField(side: 'from' | 'to', field: 'node' | 'ip', value: string) {
    const current = link[side]
    if (field === 'ip') {
      onupdate?.({ [side]: { ...current, ip: value || undefined } })
    } else {
      onupdate?.({ [side]: { ...current, [field]: value } })
    }
  }

  function updateEndpointPort(side: 'from' | 'to', portId: string) {
    const current = link[side]
    onupdate?.({ [side]: { ...current, port: portId } })
  }

  /**
   * Build the endpoint plug for a chosen standard, preserving the
   * existing SKU when it's still relevant (same standard kept, only
   * the SKU was edited). Returns undefined when both standard and sku
   * are absent — the plug is dropped entirely.
   */
  function buildPlug(
    standard: EthernetStandard | undefined,
    keepSku: string | undefined,
  ): LinkPlug | undefined {
    if (!standard) return undefined
    const built = plugFromStandard(standard, keepSku)
    return built
  }

  /**
   * Per-endpoint module standard. Symmetric is the default — picking on
   * one side mirrors to the other when the other end is empty or already
   * matched the previous value. Once the user has explicitly diverged
   * (asymmetric BiDi etc.), each side is independent.
   */
  function updateEndpointModuleStandard(
    side: 'from' | 'to',
    standard: EthernetStandard | undefined,
  ) {
    const other = side === 'from' ? 'to' : 'from'
    const current = link[side]
    const otherEp = link[other]
    const currentStd = endpointStandard(current)
    const otherStd = endpointStandard(otherEp)
    const wasSymmetric = !otherStd || otherStd === currentStd
    const newPlug = buildPlug(standard, current.plug?.module?.sku)
    const updates: Partial<Link> = { [side]: { ...current, plug: newPlug } }
    if (wasSymmetric) {
      const newOtherPlug = buildPlug(standard, otherEp.plug?.module?.sku)
      updates[other] = { ...otherEp, plug: newOtherPlug }
    }
    // Reset cable grade to the new standard's default when it was empty
    // or no longer fits the new cable kind.
    const grades = cableGradesForStandard(standard)
    const currentGrade = link.cable?.category
    const gradeFits = currentGrade && grades.some((g) => g.value === currentGrade)
    if (!gradeFits) {
      const next = { ...(link.cable ?? {}) }
      const def = defaultCableGrade(standard)
      if (def) next.category = def
      else delete next.category
      updates.cable = Object.keys(next).length > 0 ? next : undefined
    }
    onupdate?.(updates)
  }

  function updateEndpointModuleSku(side: 'from' | 'to', sku: string | undefined) {
    const current = link[side]
    const std = endpointStandard(current)
    if (!std) return
    const newPlug = buildPlug(std, sku)
    onupdate?.({ [side]: { ...current, plug: newPlug } })
  }

  function updateCableField(field: 'category' | 'length_m', value: string) {
    const next = { ...(link.cable ?? {}) }
    if (field === 'length_m') {
      const length = value ? Number.parseFloat(value) : undefined
      if (length === undefined || !Number.isFinite(length)) delete next.length_m
      else next.length_m = length
    } else if (field === 'category') {
      if (value) next.category = value as typeof next.category
      else delete next.category
    }
    onupdate?.({ cable: Object.keys(next).length > 0 ? next : undefined })
  }

  function handleVlanBlur(value: string) {
    const numbers = value
      .split(',')
      .map((v) => Number.parseInt(v.trim(), 10))
      .filter((v) => !Number.isNaN(v))
    onupdate?.({ vlan: numbers.length > 0 ? numbers : undefined })
  }

  const inputClass =
    'w-full text-[11px] px-2 py-1 bg-transparent border border-neutral-200 dark:border-neutral-700 rounded outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 text-neutral-800 dark:text-neutral-100 font-mono'

  const selectClass =
    'w-full text-[11px] px-2 py-1 bg-transparent border border-neutral-200 dark:border-neutral-700 rounded outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 text-neutral-800 dark:text-neutral-100 font-mono appearance-none cursor-pointer'

  const labelClass = 'text-[10px] font-medium text-neutral-400 dark:text-neutral-500'
  const valueClass = 'text-[11px] font-mono text-neutral-700 dark:text-neutral-200'
  const sectionClass =
    'text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5'

  const fromCage = $derived(getPortOptions(from.node).find((p) => p.id === from.port)?.cage)
  const toCage = $derived(getPortOptions(to.node).find((p) => p.id === to.port)?.cage)

  // Cable grade options follow whichever endpoint has a module set
  // (symmetric → both agree, asymmetric → BiDi pairs still share medium).
  const referenceStandard = $derived(endpointStandard(link.from) ?? endpointStandard(link.to))
  const gradeOptions = $derived(cableGradesForStandard(referenceStandard))

  const typeOptions = ['solid', 'dashed', 'thick', 'double', 'invisible']
  const redundancyOptions = ['', 'ha', 'vc', 'vss', 'vpc', 'mlag', 'stack']
  const arrowOptions = ['none', 'forward', 'back', 'both']
</script>

<!-- From endpoint -->
<div class={sectionClass}>From</div>
<dl class="space-y-2.5 mb-4">
  <div class="flex items-center justify-between">
    <dt class={labelClass}>Node</dt>
    <dd>
      {#if editing}
        <select
          class={selectClass}
          value={from.node}
          onchange={(e) => updateEndpointField('from', 'node', (e.target as HTMLSelectElement).value)}
        >
          <option value="">Select node...</option>
          {#each nodeOptions as opt}
            <option value={opt.id}>{opt.label} ({opt.id})</option>
          {/each}
        </select>
      {:else}
        <span class={valueClass}>{from.node}</span>
      {/if}
    </dd>
  </div>

  <div class="flex items-center justify-between gap-2">
    <dt class={labelClass}>Port</dt>
    <dd class="flex-1 min-w-0">
      {#if editing}
        <PortPicker
          nodeId={from.node}
          value={from.port}
          onchange={(portId) => updateEndpointPort('from', portId)}
        />
      {:else}
        <span class={valueClass}>{from.port ? displayPort(from.node, from.port) : '—'}</span>
      {/if}
    </dd>
  </div>

  <div class="flex items-center justify-between gap-2">
    <dt class={labelClass}>Plug / Module</dt>
    <dd class="flex-1 min-w-0">
      {#if editing}
        <EndpointModulePicker
          class={selectClass}
          cage={fromCage}
          standard={link.from.plug?.module?.standard}
          onchange={(v) => updateEndpointModuleStandard('from', v)}
        />
      {:else}
        <span class={valueClass}>{link.from.plug?.module?.standard ?? '—'}</span>
      {/if}
    </dd>
  </div>

  <div class="flex items-center justify-between">
    <dt class={labelClass}>SKU</dt>
    <dd>
      {#if editing}
        <input
          type="text"
          class={inputClass}
          value={link.from.plug?.module?.sku ?? ''}
          placeholder="transceiver SKU"
          onblur={(e) => updateEndpointModuleSku('from', (e.target as HTMLInputElement).value || undefined)}
        >
      {:else}
        <span class={valueClass}>{link.from.plug?.module?.sku ?? '—'}</span>
      {/if}
    </dd>
  </div>

  <div class="flex items-center justify-between">
    <dt class={labelClass}>IP</dt>
    <dd>
      {#if editing}
        <input
          type="text"
          class={inputClass}
          value={from.ip}
          placeholder="IP address"
          onblur={(e) => updateEndpointField('from', 'ip', (e.target as HTMLInputElement).value)}
          onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        >
      {:else}
        <span class={valueClass}>{from.ip || '—'}</span>
      {/if}
    </dd>
  </div>
</dl>

<!-- To endpoint -->
<div class={sectionClass}>To</div>
<dl class="space-y-2.5 mb-4">
  <div class="flex items-center justify-between">
    <dt class={labelClass}>Node</dt>
    <dd>
      {#if editing}
        <select
          class={selectClass}
          value={to.node}
          onchange={(e) => updateEndpointField('to', 'node', (e.target as HTMLSelectElement).value)}
        >
          <option value="">Select node...</option>
          {#each nodeOptions as opt}
            <option value={opt.id}>{opt.label} ({opt.id})</option>
          {/each}
        </select>
      {:else}
        <span class={valueClass}>{to.node}</span>
      {/if}
    </dd>
  </div>

  <div class="flex items-center justify-between gap-2">
    <dt class={labelClass}>Port</dt>
    <dd class="flex-1 min-w-0">
      {#if editing}
        <PortPicker
          nodeId={to.node}
          value={to.port}
          onchange={(portId) => updateEndpointPort('to', portId)}
        />
      {:else}
        <span class={valueClass}>{to.port ? displayPort(to.node, to.port) : '—'}</span>
      {/if}
    </dd>
  </div>

  <div class="flex items-center justify-between gap-2">
    <dt class={labelClass}>Plug / Module</dt>
    <dd class="flex-1 min-w-0">
      {#if editing}
        <EndpointModulePicker
          class={selectClass}
          cage={toCage}
          standard={link.to.plug?.module?.standard}
          onchange={(v) => updateEndpointModuleStandard('to', v)}
        />
      {:else}
        <span class={valueClass}>{link.to.plug?.module?.standard ?? '—'}</span>
      {/if}
    </dd>
  </div>

  <div class="flex items-center justify-between">
    <dt class={labelClass}>SKU</dt>
    <dd>
      {#if editing}
        <input
          type="text"
          class={inputClass}
          value={link.to.plug?.module?.sku ?? ''}
          placeholder="transceiver SKU"
          onblur={(e) => updateEndpointModuleSku('to', (e.target as HTMLInputElement).value || undefined)}
        >
      {:else}
        <span class={valueClass}>{link.to.plug?.module?.sku ?? '—'}</span>
      {/if}
    </dd>
  </div>

  <div class="flex items-center justify-between">
    <dt class={labelClass}>IP</dt>
    <dd>
      {#if editing}
        <input
          type="text"
          class={inputClass}
          value={to.ip}
          placeholder="IP address"
          onblur={(e) => updateEndpointField('to', 'ip', (e.target as HTMLInputElement).value)}
          onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        >
      {:else}
        <span class={valueClass}>{to.ip || '—'}</span>
      {/if}
    </dd>
  </div>
</dl>

<!-- Cable (per-link) -->
<div class={sectionClass}>Cable</div>
<dl class="space-y-2.5 mb-4">
  <div class="flex items-center justify-between">
    <dt class={labelClass}>Grade</dt>
    <dd>
      {#if editing && gradeOptions.length > 0}
        <select
          class={selectClass}
          value={link.cable?.category ?? ''}
          onchange={(e) => updateCableField('category', (e.target as HTMLSelectElement).value)}
        >
          <option value="">— unspecified —</option>
          {#each gradeOptions as g}
            <option value={g.value}>{g.label}</option>
          {/each}
        </select>
      {:else}
        <span class={valueClass}>{link.cable?.category ?? '—'}</span>
      {/if}
    </dd>
  </div>

  <div class="flex items-center justify-between">
    <dt class={labelClass}>Length (m)</dt>
    <dd>
      {#if editing}
        <input
          type="number"
          min="0"
          class={inputClass}
          value={link.cable?.length_m ?? ''}
          onblur={(e) => updateCableField('length_m', (e.target as HTMLInputElement).value)}
        >
      {:else}
        <span class={valueClass}>{link.cable?.length_m ?? '—'}</span>
      {/if}
    </dd>
  </div>
</dl>

{#if referenceStandard}
  <div class="mb-4">
    <StandardImpliedBlock standard={referenceStandard} cable={link.cable} {fromCage} {toCage} />
    {#if link.from.plug?.module?.standard && link.to.plug?.module?.standard && link.from.plug?.module?.standard !== link.to.plug?.module?.standard}
      <div class="mt-1 text-[10px] text-amber-600">
        ⚠ Asymmetric: {link.from.plug?.module?.standard} ↔ {link.to.plug?.module?.standard}
      </div>
    {/if}
  </div>
{/if}

<!-- Other link properties -->
<div class={sectionClass}>Properties</div>
<dl class="space-y-2.5">
  <div class="flex items-center justify-between">
    <dt class={labelClass}>VLAN</dt>
    <dd>
      {#if editing}
        <input
          type="text"
          class={inputClass}
          value={vlanDisplay}
          placeholder="e.g. 10, 20, 30"
          onblur={(e) => handleVlanBlur((e.target as HTMLInputElement).value)}
          onkeydown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
        >
      {:else}
        <span class={valueClass}>{vlanDisplay || '—'}</span>
      {/if}
    </dd>
  </div>

  <div class="flex items-center justify-between">
    <dt class={labelClass}>Label</dt>
    <dd>
      {#if editing}
        <input
          type="text"
          class={inputClass}
          value={labelDisplay}
          placeholder="Label"
          onblur={(e) => onupdate?.({ label: (e.target as HTMLInputElement).value || undefined })}
          onkeydown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
        >
      {:else}
        <span class={valueClass}>{labelDisplay || '—'}</span>
      {/if}
    </dd>
  </div>

  <div class="flex items-center justify-between">
    <dt class={labelClass}>Type</dt>
    <dd>
      {#if editing}
        <select
          class={selectClass}
          value={link.type ?? 'solid'}
          onchange={(e) =>
            onupdate?.({
              type: ((e.target as HTMLSelectElement).value || undefined) as Link['type'],
            })}
        >
          {#each typeOptions as t}
            <option value={t}>{t}</option>
          {/each}
        </select>
      {:else}
        <span class={valueClass}>{link.type ?? 'solid'}</span>
      {/if}
    </dd>
  </div>

  <div class="flex items-center justify-between">
    <dt class={labelClass}>Redundancy</dt>
    <dd>
      {#if editing}
        <select
          class={selectClass}
          value={link.redundancy ?? ''}
          onchange={(e) =>
            onupdate?.({
              redundancy: ((e.target as HTMLSelectElement).value || undefined) as Link['redundancy'],
            })}
        >
          {#each redundancyOptions as r}
            <option value={r}>{r || '—'}</option>
          {/each}
        </select>
      {:else}
        <span class={valueClass}>{link.redundancy ?? '—'}</span>
      {/if}
    </dd>
  </div>

  <div class="flex items-center justify-between">
    <dt class={labelClass}>Arrow</dt>
    <dd>
      {#if editing}
        <select
          class={selectClass}
          value={link.arrow ?? 'none'}
          onchange={(e) =>
            onupdate?.({ arrow: (e.target as HTMLSelectElement).value as Link['arrow'] })}
        >
          {#each arrowOptions as a}
            <option value={a}>{a}</option>
          {/each}
        </select>
      {:else}
        <span class={valueClass}>{link.arrow ?? 'none'}</span>
      {/if}
    </dd>
  </div>
</dl>
