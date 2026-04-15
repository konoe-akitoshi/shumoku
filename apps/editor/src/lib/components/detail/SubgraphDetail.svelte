<script lang="ts">
  let {
    data,
    editing = false,
    onupdate,
  }: {
    // biome-ignore lint/suspicious/noExplicitAny: mixed element data
    data: Record<string, any>
    editing?: boolean
    onupdate?: (id: string, field: string, value: string) => void
  } = $props()

  const inputClass =
    'w-full text-sm font-semibold px-2 py-0.5 -ml-2 bg-transparent border border-transparent hover:border-neutral-200 focus:border-neutral-300 dark:hover:border-neutral-600 dark:focus:border-neutral-500 rounded outline-none focus:ring-1 focus:ring-blue-400 text-neutral-800 dark:text-neutral-100'
</script>

<!-- Label -->
<div>
  {#if editing}
    <input
      type="text"
      class={inputClass}
      value={data.label ?? ''}
      placeholder="Group label"
      onblur={(e) => { if (data.id) onupdate?.(data.id, 'label', (e.target as HTMLInputElement).value) }}
      onkeydown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
    >
  {:else}
    <div class="text-sm font-semibold text-neutral-800 dark:text-neutral-100 truncate">
      {data.label ?? data.id}
    </div>
  {/if}
</div>

<!-- Info -->
<div>
  <div
    class="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1.5"
  >
    Group Info
  </div>
  <dl class="space-y-1.5 text-[11px]">
    {#if data.children}
      <div class="flex justify-between">
        <dt class="text-neutral-400 dark:text-neutral-500">Children</dt>
        <dd class="font-mono">{data.children.nodes} nodes, {data.children.subgraphs} groups</dd>
      </div>
    {/if}
    {#if data.direction}
      <div class="flex justify-between">
        <dt class="text-neutral-400 dark:text-neutral-500">Direction</dt>
        <dd class="font-mono">{data.direction}</dd>
      </div>
    {/if}
    {#if data.parent}
      <div class="flex justify-between">
        <dt class="text-neutral-400 dark:text-neutral-500">Parent</dt>
        <dd class="font-mono">{data.parent}</dd>
      </div>
    {/if}
    {#if data.bounds}
      <div class="flex justify-between">
        <dt class="text-neutral-400 dark:text-neutral-500">Size</dt>
        <dd class="font-mono">{data.bounds.width.toFixed(0)} × {data.bounds.height.toFixed(0)}</dd>
      </div>
    {/if}
  </dl>
</div>
