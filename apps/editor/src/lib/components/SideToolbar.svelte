<script lang="ts">
  import { DeviceType, type NodeSpec } from '@shumoku/core'
  import { DropdownMenu, Tooltip } from 'bits-ui'
  import {
    ArrowsOutCardinal,
    Cube,
    Eye,
    Moon,
    Pencil,
    Plus,
    SquaresFour,
    Sun,
  } from 'phosphor-svelte'

  let {
    mode = 'view',
    isDark = false,
    onmodechange,
    onaddnode,
    onaddsubgraph,
    onautoarrange,
    onthemetoggle,
  }: {
    mode: 'edit' | 'view'
    isDark?: boolean
    onmodechange?: (mode: 'edit' | 'view') => void
    onaddnode?: (spec?: NodeSpec) => void
    onaddsubgraph?: () => void
    onautoarrange?: () => void
    onthemetoggle?: () => void
  } = $props()

  const editing = $derived(mode === 'edit')

  const nodeTypes: Array<{ label: string; spec?: NodeSpec }> = [
    { label: 'Generic Node' },
    { label: '---' },
    { label: 'Router', spec: { kind: 'hardware', type: DeviceType.Router } },
    { label: 'Firewall', spec: { kind: 'hardware', type: DeviceType.Firewall } },
    { label: 'L2 Switch', spec: { kind: 'hardware', type: DeviceType.L2Switch } },
    { label: 'L3 Switch', spec: { kind: 'hardware', type: DeviceType.L3Switch } },
    { label: 'Server', spec: { kind: 'hardware', type: DeviceType.Server } },
    { label: 'Access Point', spec: { kind: 'hardware', type: DeviceType.AccessPoint } },
    { label: 'CPE / Phone', spec: { kind: 'hardware', type: DeviceType.CPE } },
    { label: 'Internet', spec: { kind: 'hardware', type: DeviceType.Internet } },
    { label: '---' },
    { label: 'VM / Compute', spec: { kind: 'compute' } },
    { label: 'Cloud Service', spec: { kind: 'service', service: '' } },
  ]
</script>

<div
  class="flex flex-col gap-1.5 p-1.5 bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-lg transition-all duration-200"
>
  <!-- Edit tools (show when editing) -->
  {#if editing}
    <DropdownMenu.Root>
      <Tooltip.Root>
        <Tooltip.Trigger>
          <DropdownMenu.Trigger>
            {#snippet child({ props })}
              <button
                type="button"
                class="flex items-center justify-center w-9 h-9 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                {...props}
              >
                <div class="relative">
                  <Cube class="w-4.5 h-4.5" />
                  <Plus
                    class="w-2.5 h-2.5 absolute -bottom-0.5 -right-0.5 text-blue-500"
                    weight="bold"
                  />
                </div>
              </button>
            {/snippet}
          </DropdownMenu.Trigger>
        </Tooltip.Trigger>
        <Tooltip.Content
          side="left"
          class="bg-neutral-800 text-white text-xs px-2 py-1 rounded shadow-lg"
        >
          Add node
        </Tooltip.Content>
      </Tooltip.Root>
      <DropdownMenu.Content
        side="left"
        class="z-50 min-w-40 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-1 shadow-lg"
      >
        {#each nodeTypes as item}
          {#if item.label === '---'}
            <DropdownMenu.Separator class="my-1 h-px bg-neutral-200 dark:bg-neutral-700" />
          {:else}
            <DropdownMenu.Item
              class="flex items-center rounded-md px-2.5 py-1.5 text-xs cursor-pointer text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700"
              onclick={() => onaddnode?.(item.spec)}
            >
              {item.label}
            </DropdownMenu.Item>
          {/if}
        {/each}
      </DropdownMenu.Content>
    </DropdownMenu.Root>

    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          type="button"
          class="flex items-center justify-center w-9 h-9 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
          onclick={() => onaddsubgraph?.()}
        >
          <div class="relative">
            <SquaresFour class="w-4.5 h-4.5" />
            <Plus class="w-2.5 h-2.5 absolute -bottom-0.5 -right-0.5 text-blue-500" weight="bold" />
          </div>
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content
        side="left"
        class="bg-neutral-800 text-white text-xs px-2 py-1 rounded shadow-lg"
      >
        Add group
      </Tooltip.Content>
    </Tooltip.Root>

    <Tooltip.Root>
      <Tooltip.Trigger>
        <button
          type="button"
          class="flex items-center justify-center w-9 h-9 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
          onclick={() => onautoarrange?.()}
        >
          <ArrowsOutCardinal class="w-4.5 h-4.5" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content
        side="left"
        class="bg-neutral-800 text-white text-xs px-2 py-1 rounded shadow-lg"
      >
        Auto-arrange
      </Tooltip.Content>
    </Tooltip.Root>

    <div class="border-t border-neutral-200 dark:border-neutral-700 my-0.5"></div>
  {/if}

  <!-- Edit/View toggle (bottom) -->
  <Tooltip.Root>
    <Tooltip.Trigger>
      <button
        type="button"
        class="flex items-center justify-center w-9 h-9 rounded-lg transition-colors {editing ? 'bg-blue-500 text-white shadow-sm' : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700'}"
        onclick={() => onmodechange?.(editing ? 'view' : 'edit')}
      >
        {#if editing}
          <Eye class="w-4.5 h-4.5" weight="bold" />
        {:else}
          <Pencil class="w-4.5 h-4.5" />
        {/if}
      </button>
    </Tooltip.Trigger>
    <Tooltip.Content
      side="left"
      class="bg-neutral-800 text-white text-xs px-2 py-1 rounded shadow-lg"
    >
      {editing ? 'Switch to View mode' : 'Switch to Edit mode'}
    </Tooltip.Content>
  </Tooltip.Root>

  <!-- Theme toggle -->
  <Tooltip.Root>
    <Tooltip.Trigger>
      <button
        type="button"
        class="flex items-center justify-center w-9 h-9 rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
        onclick={() => onthemetoggle?.()}
      >
        {#if isDark}
          <Sun class="w-4.5 h-4.5" />
        {:else}
          <Moon class="w-4.5 h-4.5" />
        {/if}
      </button>
    </Tooltip.Trigger>
    <Tooltip.Content
      side="left"
      class="bg-neutral-800 text-white text-xs px-2 py-1 rounded shadow-lg"
    >
      {isDark ? 'Light mode' : 'Dark mode'}
    </Tooltip.Content>
  </Tooltip.Root>
</div>
