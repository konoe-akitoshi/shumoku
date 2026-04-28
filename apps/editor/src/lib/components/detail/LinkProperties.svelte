<script lang="ts">
  import type { Link, LinkEndpoint, Node } from '@shumoku/core'
  import PlugCablePicker from '$lib/components/PlugCablePicker.svelte'
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

  function hasPortOption(nodeId: string, portId: string) {
    if (!portId) return true
    return getPortOptions(nodeId).some((p) => p.id === portId)
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

<!-- Link properties -->
<div class={sectionClass}>Properties</div>
<dl class="space-y-2.5">
  <div class="flex items-center justify-between gap-2">
    <dt class={labelClass}>Link spec</dt>
    <dd class="flex-1 min-w-0">
      {#if editing}
        <PlugCablePicker
          class={selectClass}
          standard={link.from.module?.standard ?? link.to.module?.standard}
          cableCategory={link.cable?.category}
          {fromCage}
          {toCage}
          onstandardchange={(v) => {
            // Symmetric default — both endpoints get the same module
            // standard. Asymmetric BiDi pairs are an advanced override
            // that's not surfaced here yet.
            const fromModule = v ? { ...(link.from.module ?? {}), standard: v } : undefined
            const toModule = v ? { ...(link.to.module ?? {}), standard: v } : undefined
            onupdate?.({
              from: { ...link.from, module: fromModule },
              to: { ...link.to, module: toModule },
            })
          }}
          oncategorychange={(v) => {
            const next = { ...(link.cable ?? {}) }
            if (v) next.category = v
            else delete next.category
            onupdate?.({ cable: Object.keys(next).length > 0 ? next : undefined })
          }}
        />
      {:else}
        <span class={valueClass}
          >{link.from.module?.standard ?? link.to.module?.standard ?? '—'}</span
        >
      {/if}
    </dd>
  </div>

  {#if link.from.module?.standard || link.to.module?.standard}
    <div>
      <StandardImpliedBlock
        standard={link.from.module?.standard ?? link.to.module?.standard}
        cable={link.cable}
        {fromCage}
        {toCage}
      />
    </div>
  {/if}

  <div class="flex items-center justify-between">
    <dt class={labelClass}>Cable length (m)</dt>
    <dd>
      {#if editing}
        <input
          type="number"
          min="0"
          class={inputClass}
          value={link.cable?.length_m ?? ''}
          onblur={(e) => {
            const raw = (e.target as HTMLInputElement).value
            const length = raw ? Number.parseFloat(raw) : undefined
            const nextCable = { ...(link.cable ?? {}) }
            if (length === undefined || !Number.isFinite(length)) delete nextCable.length_m
            else nextCable.length_m = length
            onupdate?.({ cable: Object.keys(nextCable).length > 0 ? nextCable : undefined })
          }}
        >
      {:else}
        <span class={valueClass}>{link.cable?.length_m ?? '—'}</span>
      {/if}
    </dd>
  </div>

  <div class="flex items-center justify-between">
    <dt class={labelClass}>Cable connector</dt>
    <dd>
      {#if editing}
        <input
          type="text"
          class={inputClass}
          value={link.cable?.connector ?? ''}
          placeholder="auto (LC/RJ45/MPO…)"
          onblur={(e) => {
            const raw = (e.target as HTMLInputElement).value.trim()
            const nextCable = { ...(link.cable ?? {}) }
            if (raw) nextCable.connector = raw
            else delete nextCable.connector
            onupdate?.({ cable: Object.keys(nextCable).length > 0 ? nextCable : undefined })
          }}
        >
      {:else}
        <span class={valueClass}>{link.cable?.connector ?? '—'}</span>
      {/if}
    </dd>
  </div>

  <div class="flex items-center justify-between">
    <dt class={labelClass}>From plug (SKU)</dt>
    <dd>
      {#if editing}
        <input
          type="text"
          class={inputClass}
          value={link.from.module?.sku ?? ''}
          placeholder="transceiver SKU"
          onblur={(e) => {
            const sku = (e.target as HTMLInputElement).value || undefined
            const std = link.from.module?.standard
            const nextModule = std || sku ? { standard: std ?? '', sku } : undefined
            onupdate?.({ from: { ...link.from, module: nextModule } })
          }}
        >
      {:else}
        <span class={valueClass}>{link.from.module?.sku ?? '—'}</span>
      {/if}
    </dd>
  </div>

  <div class="flex items-center justify-between">
    <dt class={labelClass}>To plug (SKU)</dt>
    <dd>
      {#if editing}
        <input
          type="text"
          class={inputClass}
          value={link.to.module?.sku ?? ''}
          placeholder="transceiver SKU"
          onblur={(e) => {
            const sku = (e.target as HTMLInputElement).value || undefined
            const std = link.to.module?.standard
            const nextModule = std || sku ? { standard: std ?? '', sku } : undefined
            onupdate?.({ to: { ...link.to, module: nextModule } })
          }}
        >
      {:else}
        <span class={valueClass}>{link.to.module?.sku ?? '—'}</span>
      {/if}
    </dd>
  </div>

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
          onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
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
          onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
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
          onchange={(e) => onupdate?.({ type: ((e.target as HTMLSelectElement).value || undefined) as Link['type'] })}
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
          onchange={(e) => onupdate?.({ redundancy: ((e.target as HTMLSelectElement).value || undefined) as Link['redundancy'] })}
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
          onchange={(e) => onupdate?.({ arrow: ((e.target as HTMLSelectElement).value) as Link['arrow'] })}
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
