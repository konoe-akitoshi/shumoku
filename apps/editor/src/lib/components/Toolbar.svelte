<script lang="ts">
  import { Tooltip } from 'bits-ui'
  import {
    Cube,
    DownloadSimple,
    Eye,
    FloppyDisk,
    Info,
    MouseSimple,
    Pencil,
    Plus,
    SquaresFour,
    TreeStructure,
    UploadSimple,
  } from 'phosphor-svelte'

  let {
    mode = 'view',
    stats = { nodes: 0, links: 0, subgraphs: 0 },
    selected = null,
    status = 'Loading...',
    onmodechange,
    onaddnode,
    onaddsubgraph,
    onsave,
    onload,
  }: {
    mode: 'edit' | 'view'
    stats: { nodes: number; links: number; subgraphs: number }
    selected: { id: string; type: string } | null
    status: string
    onmodechange?: (mode: 'edit' | 'view') => void
    onaddnode?: () => void
    onaddsubgraph?: () => void
    onsave?: () => void
    onload?: () => void
  } = $props()
</script>

<div
  class="flex items-center gap-2 px-4 py-2.5 border-b bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 shadow-sm z-10"
>
  <TreeStructure class="w-5 h-5 text-blue-500" weight="bold" />
  <h1 class="text-base font-semibold text-slate-800 dark:text-neutral-100">Network Editor</h1>

  <div class="w-px h-5 bg-slate-200 dark:bg-neutral-700 mx-2"></div>

  <!-- Mode toggle -->
  <div class="flex items-center bg-slate-100 dark:bg-neutral-800 rounded-md p-0.5">
    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          type="button"
          class="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors {mode === 'edit' ? 'bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200'}"
          onclick={() => onmodechange?.('edit')}
        >
          <Pencil class="w-3.5 h-3.5" />
          Edit
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content class="bg-neutral-800 text-white text-xs px-2 py-1 rounded shadow-lg">
        Edit mode — drag, add, delete
      </Tooltip.Content>
    </Tooltip.Root>
    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          type="button"
          class="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors {mode === 'view' ? 'bg-white dark:bg-neutral-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200'}"
          onclick={() => onmodechange?.('view')}
        >
          <Eye class="w-3.5 h-3.5" />
          View
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content class="bg-neutral-800 text-white text-xs px-2 py-1 rounded shadow-lg">
        View mode — pan and zoom only
      </Tooltip.Content>
    </Tooltip.Root>
  </div>

  <div class="w-px h-5 bg-slate-200 dark:bg-neutral-700 mx-2"></div>

  <!-- Stats -->
  <div class="flex items-center gap-3 text-xs text-slate-500 dark:text-neutral-400">
    <span>{stats.nodes} nodes</span>
    <span>{stats.links} links</span>
    <span>{stats.subgraphs} groups</span>
  </div>

  <div class="w-px h-5 bg-slate-200 dark:bg-neutral-700 mx-2"></div>

  <!-- Add buttons (edit mode only) -->
  {#if mode === 'edit'}
    <div class="flex items-center gap-1">
      <Tooltip.Root>
        <Tooltip.Trigger>
          <button
            type="button"
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-700 transition-colors"
            onclick={() => onaddnode?.()}
          >
            <Cube class="w-3.5 h-3.5" />
            <Plus class="w-3 h-3" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content class="bg-neutral-800 text-white text-xs px-2 py-1 rounded shadow-lg">
          Add node
        </Tooltip.Content>
      </Tooltip.Root>
      <Tooltip.Root>
        <Tooltip.Trigger>
          <button
            type="button"
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-700 transition-colors"
            onclick={() => onaddsubgraph?.()}
          >
            <SquaresFour class="w-3.5 h-3.5" />
            <Plus class="w-3 h-3" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Content class="bg-neutral-800 text-white text-xs px-2 py-1 rounded shadow-lg">
          Add group
        </Tooltip.Content>
      </Tooltip.Root>
    </div>

    <div class="w-px h-5 bg-slate-200 dark:bg-neutral-700 mx-2"></div>
  {/if}

  <!-- Save/Load -->
  <div class="flex items-center gap-1">
    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-700 transition-colors"
          onclick={() => onsave?.()}
        >
          <DownloadSimple class="w-3.5 h-3.5" />
          <span>Save</span>
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content class="bg-neutral-800 text-white text-xs px-2 py-1 rounded shadow-lg">
        Save diagram as JSON
      </Tooltip.Content>
    </Tooltip.Root>
    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-700 transition-colors"
          onclick={() => onload?.()}
        >
          <UploadSimple class="w-3.5 h-3.5" />
          <span>Load</span>
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content class="bg-neutral-800 text-white text-xs px-2 py-1 rounded shadow-lg">
        Load diagram from JSON
      </Tooltip.Content>
    </Tooltip.Root>
  </div>

  <div class="flex-1"></div>

  <!-- Selection display -->
  {#if selected}
    <div
      class="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-full text-xs font-medium"
    >
      <span class="capitalize">{selected.type}</span>
      <span class="text-blue-400">·</span>
      <span class="font-mono">{selected.id}</span>
    </div>
  {:else}
    <div class="flex items-center gap-1.5 text-xs text-slate-400">
      <MouseSimple class="w-3.5 h-3.5" />
      <span>Click to select</span>
    </div>
  {/if}

  <div class="w-px h-5 bg-slate-200 dark:bg-neutral-700 mx-2"></div>

  <!-- Status -->
  <div class="flex items-center gap-1.5">
    <div
      class="w-2 h-2 rounded-full {status === 'Ready' ? 'bg-green-400' : 'bg-amber-400 animate-pulse'}"
    ></div>
    <span class="text-xs text-slate-500 dark:text-neutral-400">{status}</span>
  </div>
</div>
