<script lang="ts">
  import type { Link } from '@shumoku/core'
  import { Badge } from '$lib/components/ui/badge'

  let {
    data,
    links = [],
  }: {
    // biome-ignore lint/suspicious/noExplicitAny: mixed element data
    data: Record<string, any>
    links?: Link[]
  } = $props()

  // Find connection for this port
  const connection = $derived.by(() => {
    if (!data.nodeId || !data.label) return null
    for (const link of links) {
      const from = typeof link.from === 'object' ? link.from : null
      const to = typeof link.to === 'object' ? link.to : null
      if (from?.node === data.nodeId && from?.port === data.label) {
        return {
          direction: 'out' as const,
          peerNode: to?.node ?? (typeof link.to === 'string' ? link.to : '—'),
          peerPort: to?.port,
          bandwidth: link.bandwidth,
          vlan: link.vlan,
          ip: from?.ip,
          peerIp: to?.ip,
        }
      }
      if (to?.node === data.nodeId && to?.port === data.label) {
        return {
          direction: 'in' as const,
          peerNode: from?.node ?? (typeof link.from === 'string' ? link.from : '—'),
          peerPort: from?.port,
          bandwidth: link.bandwidth,
          vlan: link.vlan,
          ip: to?.ip,
          peerIp: from?.ip,
        }
      }
    }
    return null
  })
</script>

<!-- Port info -->
<div>
  <div class="text-sm font-semibold font-mono text-neutral-800 dark:text-neutral-100 mb-2">
    {data.label ?? data.id}
  </div>
  <dl class="space-y-1.5 text-[11px]">
    {#if data.nodeId}
      <div class="flex justify-between">
        <dt class="text-neutral-400 dark:text-neutral-500">Node</dt>
        <dd class="font-mono">{data.nodeId}</dd>
      </div>
    {/if}
    {#if data.side}
      <div class="flex justify-between">
        <dt class="text-neutral-400 dark:text-neutral-500">Side</dt>
        <dd class="font-mono">{data.side}</dd>
      </div>
    {/if}
  </dl>
</div>

<!-- Connection -->
{#if connection}
  <div>
    <div
      class="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5"
    >
      Connected to
    </div>
    <div class="px-2.5 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-700/30 text-[11px]">
      <div class="flex items-center gap-1.5">
        <span class="text-neutral-300 dark:text-neutral-600"
          >{connection.direction === 'out' ? '→' : '←'}</span
        >
        <span class="font-mono font-medium text-neutral-700 dark:text-neutral-200"
          >{connection.peerNode}</span
        >
        {#if connection.peerPort}
          <span class="font-mono text-blue-600 dark:text-blue-400">:{connection.peerPort}</span>
        {/if}
        {#if connection.bandwidth}
          <Badge variant="secondary" class="ml-auto font-mono text-[9px]"
            >{connection.bandwidth}</Badge
          >
        {/if}
      </div>
      {#if connection.ip || connection.peerIp || connection.vlan}
        <div class="flex gap-3 mt-1 text-[9px] text-neutral-400 dark:text-neutral-500">
          {#if connection.ip}
            <span>Local: {connection.ip}</span>
          {/if}
          {#if connection.peerIp}
            <span>Remote: {connection.peerIp}</span>
          {/if}
          {#if connection.vlan}
            <span
              >VLAN
              {Array.isArray(connection.vlan)
                ? connection.vlan.join(', ')
                : connection.vlan}</span
            >
          {/if}
        </div>
      {/if}
    </div>
  </div>
{:else}
  <div class="text-[11px] text-neutral-400 dark:text-neutral-500 italic">Not connected</div>
{/if}
