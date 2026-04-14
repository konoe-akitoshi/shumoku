<script lang="ts">
  let {
    status = 'Ready',
    stats = { nodes: 0, links: 0, subgraphs: 0 },
    selected = null,
  }: {
    status: string
    stats: { nodes: number; links: number; subgraphs: number }
    selected: { id: string; type: string } | null
  } = $props()
</script>

<div
  class="flex items-center gap-3 px-3 py-2 bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-lg text-xs"
>
  <!-- Status dot -->
  <div class="flex items-center gap-1.5">
    <div
      class="w-1.5 h-1.5 rounded-full {status === 'Ready' ? 'bg-green-400' : 'bg-amber-400 animate-pulse'}"
    ></div>
    <span class="text-neutral-500 dark:text-neutral-400">{status}</span>
  </div>

  <div class="text-neutral-300 dark:text-neutral-600">|</div>

  <!-- Stats -->
  <div class="flex items-center gap-2 text-neutral-400 dark:text-neutral-500">
    <span>{stats.nodes}N</span>
    <span>{stats.links}L</span>
    <span>{stats.subgraphs}G</span>
  </div>

  <!-- Selection -->
  {#if selected}
    <div class="text-neutral-300 dark:text-neutral-600">|</div>
    <div class="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
      <span class="capitalize">{selected.type}</span>
      <span class="font-mono text-blue-400 dark:text-blue-500">{selected.id}</span>
    </div>
  {/if}
</div>
