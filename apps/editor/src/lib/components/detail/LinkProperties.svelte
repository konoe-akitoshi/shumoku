<script lang="ts">
  import type { Link, LinkEndpoint, Node } from '@shumoku/core'

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

  function getEndpoint(ep: string | LinkEndpoint) {
    if (typeof ep === 'string') return { node: ep, port: '', ip: '' }
    return {
      node: ep.node,
      port: ep.port ?? '',
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
    const attrs = [
      port.faceplateLabel && port.faceplateLabel !== port.label
        ? `panel ${port.faceplateLabel}`
        : '',
      port.speed,
      port.connector ?? port.media,
      port.poe ? 'PoE' : '',
    ]
      .filter(Boolean)
      .join(', ')
    return attrs ? `${port.label} (${attrs})` : port.label
  }

  function displayPort(nodeId: string, portId: string) {
    return getPortOptions(nodeId).find((p) => p.id === portId)?.label ?? portId
  }

  function updateEndpointField(side: 'from' | 'to', field: 'node' | 'port' | 'ip', value: string) {
    const current = typeof link[side] === 'object' ? link[side] : { node: link[side] as string }
    if (field === 'node') {
      onupdate?.({ [side]: { ...current, node: value } })
    } else if (field === 'ip') {
      onupdate?.({ [side]: { ...current, [field]: value || undefined } })
    } else {
      onupdate?.({ [side]: { ...current, [field]: value || undefined } })
    }
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

  const bandwidthOptions = ['', '1G', '10G', '25G', '40G', '100G']
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

  <div class="flex items-center justify-between">
    <dt class={labelClass}>Port</dt>
    <dd>
      {#if editing}
        {#if getPortOptions(from.node).length > 0}
          <select
            class={selectClass}
            value={from.port}
            onchange={(e) => updateEndpointField('from', 'port', (e.target as HTMLSelectElement).value)}
          >
            <option value="">Unassigned</option>
            {#if from.port && !hasPortOption(from.node, from.port)}
              <option value={from.port}>{displayPort(from.node, from.port)} (custom)</option>
            {/if}
            {#each getPortOptions(from.node) as port}
              <option value={port.id} disabled={port.disabled}>{portOptionLabel(port)}</option>
            {/each}
          </select>
        {:else}
          <input
            type="text"
            class={inputClass}
            value={from.port}
            placeholder="Port"
            onblur={(e) => updateEndpointField('from', 'port', (e.target as HTMLInputElement).value)}
            onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          >
        {/if}
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

  <div class="flex items-center justify-between">
    <dt class={labelClass}>Port</dt>
    <dd>
      {#if editing}
        {#if getPortOptions(to.node).length > 0}
          <select
            class={selectClass}
            value={to.port}
            onchange={(e) => updateEndpointField('to', 'port', (e.target as HTMLSelectElement).value)}
          >
            <option value="">Unassigned</option>
            {#if to.port && !hasPortOption(to.node, to.port)}
              <option value={to.port}>{displayPort(to.node, to.port)} (custom)</option>
            {/if}
            {#each getPortOptions(to.node) as port}
              <option value={port.id} disabled={port.disabled}>{portOptionLabel(port)}</option>
            {/each}
          </select>
        {:else}
          <input
            type="text"
            class={inputClass}
            value={to.port}
            placeholder="Port"
            onblur={(e) => updateEndpointField('to', 'port', (e.target as HTMLInputElement).value)}
            onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          >
        {/if}
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
  <div class="flex items-center justify-between">
    <dt class={labelClass}>Bandwidth</dt>
    <dd>
      {#if editing}
        <select
          class={selectClass}
          value={link.bandwidth ?? ''}
          onchange={(e) => onupdate?.({ bandwidth: ((e.target as HTMLSelectElement).value || undefined) as Link['bandwidth'] })}
        >
          {#each bandwidthOptions as bw}
            <option value={bw}>{bw || '—'}</option>
          {/each}
        </select>
      {:else}
        <span class={valueClass}>{link.bandwidth ?? '—'}</span>
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
