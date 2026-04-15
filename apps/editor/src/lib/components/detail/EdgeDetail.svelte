<script lang="ts">
  import { Badge } from '$lib/components/ui/badge'

  let {
    data,
  }: {
    // biome-ignore lint/suspicious/noExplicitAny: mixed element data
    data: Record<string, any>
  } = $props()
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
      <div class="font-mono font-medium text-neutral-800 dark:text-neutral-100">
        {data.from?.node ?? '—'}
      </div>
      {#if data.from?.port}
        <div class="font-mono text-[10px] text-blue-600 dark:text-blue-400">{data.from.port}</div>
      {/if}
      {#if data.from?.ip}
        <div class="font-mono text-[10px] text-neutral-400">{data.from.ip}</div>
      {/if}
    </div>
    <span class="text-neutral-300 dark:text-neutral-600 text-lg">→</span>
    <div class="flex-1 px-2.5 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-700/30">
      <div class="text-[9px] uppercase text-neutral-400 dark:text-neutral-500 mb-0.5">To</div>
      <div class="font-mono font-medium text-neutral-800 dark:text-neutral-100">
        {data.to?.node ?? '—'}
      </div>
      {#if data.to?.port}
        <div class="font-mono text-[10px] text-blue-600 dark:text-blue-400">{data.to.port}</div>
      {/if}
      {#if data.to?.ip}
        <div class="font-mono text-[10px] text-neutral-400">{data.to.ip}</div>
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
    {#if data.bandwidth}
      <div class="flex justify-between">
        <dt class="text-neutral-400 dark:text-neutral-500">Bandwidth</dt>
        <dd><Badge variant="secondary" class="font-mono text-[10px]">{data.bandwidth}</Badge></dd>
      </div>
    {/if}
    {#if data.vlan}
      <div class="flex justify-between">
        <dt class="text-neutral-400 dark:text-neutral-500">VLAN</dt>
        <dd class="font-mono">{Array.isArray(data.vlan) ? data.vlan.join(', ') : data.vlan}</dd>
      </div>
    {/if}
    {#if data.label}
      <div class="flex justify-between">
        <dt class="text-neutral-400 dark:text-neutral-500">Label</dt>
        <dd>{Array.isArray(data.label) ? data.label.join(', ') : data.label}</dd>
      </div>
    {/if}
    {#if data.type}
      <div class="flex justify-between">
        <dt class="text-neutral-400 dark:text-neutral-500">Type</dt>
        <dd class="font-mono">{data.type}</dd>
      </div>
    {/if}
    {#if data.redundancy}
      <div class="flex justify-between">
        <dt class="text-neutral-400 dark:text-neutral-500">Redundancy</dt>
        <dd class="font-mono uppercase">{data.redundancy}</dd>
      </div>
    {/if}
  </dl>
</div>
