<script lang="ts">
  import type { Link, Node } from '@shumoku/core'
  import { Badge } from '$lib/components/ui/badge'

  let {
    link,
    nodes = new Map(),
  }: {
    link: Link
    nodes?: Map<string, Node>
  } = $props()

  const fromNode = $derived(link.from.node)
  const toNode = $derived(link.to.node)
  const fromPort = $derived(link.from.port)
  const toPort = $derived(link.to.port)
  const fromIp = $derived(link.from.ip)
  const toIp = $derived(link.to.ip)
  const vlanDisplay = $derived(
    link.vlan ? (Array.isArray(link.vlan) ? link.vlan.join(', ') : String(link.vlan)) : undefined,
  )
  const labelDisplay = $derived(
    link.label ? (Array.isArray(link.label) ? link.label.join(', ') : link.label) : undefined,
  )

  function displayPort(nodeId: string, portId: string | undefined) {
    if (!portId) return ''
    const port = nodes.get(nodeId)?.ports?.find((p) => p.id === portId)
    if (!port) return portId
    return port.label || port.cage || 'unnamed port'
  }
</script>

<!-- Endpoints -->
<div class="space-y-2">
  <div
    class="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500"
  >
    Endpoints
  </div>
  <div class="flex items-center gap-2 text-xs">
    <div class="flex-1 px-2.5 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-700/30">
      <div class="text-[9px] uppercase text-neutral-400 dark:text-neutral-500 mb-0.5">From</div>
      <div class="font-mono font-medium text-neutral-800 dark:text-neutral-100">{fromNode}</div>
      {#if fromPort}
        <div class="font-mono text-[10px] text-blue-600 dark:text-blue-400">
          {displayPort(fromNode, fromPort)}
        </div>
      {/if}
      {#if fromIp}
        <div class="font-mono text-[10px] text-neutral-400">{fromIp}</div>
      {/if}
    </div>
    <span class="text-neutral-300 dark:text-neutral-600 text-lg">{'\u2192'}</span>
    <div class="flex-1 px-2.5 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-700/30">
      <div class="text-[9px] uppercase text-neutral-400 dark:text-neutral-500 mb-0.5">To</div>
      <div class="font-mono font-medium text-neutral-800 dark:text-neutral-100">{toNode}</div>
      {#if toPort}
        <div class="font-mono text-[10px] text-blue-600 dark:text-blue-400">
          {displayPort(toNode, toPort)}
        </div>
      {/if}
      {#if toIp}
        <div class="font-mono text-[10px] text-neutral-400">{toIp}</div>
      {/if}
    </div>
  </div>
</div>

<!-- Link properties -->
<div>
  <div
    class="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5"
  >
    Properties
  </div>
  <dl class="space-y-1.5 text-[11px]">
    {#if link.bandwidth}
      <div class="flex justify-between">
        <dt class="text-neutral-400 dark:text-neutral-500">Bandwidth</dt>
        <dd><Badge variant="secondary" class="font-mono text-[10px]">{link.bandwidth}</Badge></dd>
      </div>
    {/if}
    {#if vlanDisplay}
      <div class="flex justify-between">
        <dt class="text-neutral-400 dark:text-neutral-500">VLAN</dt>
        <dd class="font-mono">{vlanDisplay}</dd>
      </div>
    {/if}
    {#if labelDisplay}
      <div class="flex justify-between">
        <dt class="text-neutral-400 dark:text-neutral-500">Label</dt>
        <dd>{labelDisplay}</dd>
      </div>
    {/if}
    {#if link.type}
      <div class="flex justify-between">
        <dt class="text-neutral-400 dark:text-neutral-500">Type</dt>
        <dd class="font-mono">{link.type}</dd>
      </div>
    {/if}
    {#if link.redundancy}
      <div class="flex justify-between">
        <dt class="text-neutral-400 dark:text-neutral-500">Redundancy</dt>
        <dd class="font-mono uppercase">{link.redundancy}</dd>
      </div>
    {/if}
  </dl>
</div>
