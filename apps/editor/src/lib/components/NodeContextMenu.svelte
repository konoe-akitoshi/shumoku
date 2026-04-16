<script lang="ts">
  import type { Subgraph } from '@shumoku/core'
  import { ArrowsOutCardinal, ClipboardText, Copy, Info, Trash } from 'phosphor-svelte'

  let {
    id,
    type,
    x,
    y,
    mode = 'view',
    hasClipboard = false,
    subgraphs = new Map(),
    currentParent,
    oncopy,
    onpaste,
    ondelete,
    ondetails,
    onmovetogroup,
    onclose,
  }: {
    id: string
    type: string
    x: number
    y: number
    mode?: 'edit' | 'view'
    hasClipboard?: boolean
    subgraphs?: Map<string, Subgraph>
    currentParent?: string
    oncopy?: (id: string, type: string) => void
    onpaste?: (x: number, y: number) => void
    ondelete?: (id: string, type: string) => void
    ondetails?: (id: string) => void
    onmovetogroup?: (id: string, groupId: string | undefined) => void
    onclose?: () => void
  } = $props()

  const editing = $derived(mode === 'edit')
  let showGroupSubmenu = $state(false)

  const groupOptions = $derived.by(() => {
    const options: { id: string | undefined; label: string }[] = []
    if (currentParent) {
      options.push({ id: undefined, label: '(None)' })
    }
    for (const [sgId, sg] of subgraphs) {
      if (sgId === id) continue
      if (sgId === currentParent) continue
      options.push({ id: sgId, label: sg.label ?? sgId })
    }
    return options
  })

  function handleAction(action: () => void) {
    action()
    onclose?.()
  }

  const itemClass =
    'flex items-center gap-2 w-full px-3 py-1.5 text-left text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors'
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-40"
  onclick={() => onclose?.()}
  oncontextmenu={(e) => {
    e.preventDefault()
    onclose?.()
  }}
></div>
<div
  class="fixed z-50 min-w-[160px] bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-lg py-1 text-sm"
  style="top: {y}px; left: {x}px;"
  role="menu"
>
  <!-- Header -->
  <div
    class="flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-400 dark:text-neutral-500 font-medium"
  >
    <Info class="w-3 h-3" />
    <span class="uppercase tracking-wider">{type}</span>
    <span class="font-mono text-neutral-300 dark:text-neutral-600 truncate max-w-[120px]"
      >{id}</span
    >
  </div>

  <!-- Details -->
  <button
    type="button"
    role="menuitem"
    class={itemClass}
    onclick={() => handleAction(() => ondetails?.(id))}
  >
    <Info class="w-4 h-4 text-neutral-400" />
    Information
  </button>

  {#if editing}
    <div class="my-1 border-t border-neutral-200 dark:border-neutral-700"></div>

    {#if type === 'node' || type === 'subgraph'}
      <button
        type="button"
        role="menuitem"
        class={itemClass}
        onclick={() => handleAction(() => oncopy?.(id, type))}
      >
        <Copy class="w-4 h-4 text-neutral-400" />
        Copy
      </button>
    {/if}

    {#if hasClipboard}
      <button
        type="button"
        role="menuitem"
        class={itemClass}
        onclick={() => handleAction(() => onpaste?.(x, y))}
      >
        <ClipboardText class="w-4 h-4 text-neutral-400" />
        Paste here
      </button>
    {/if}

    <!-- Move to group (node only, when subgraphs exist) -->
    {#if type === 'node' && groupOptions.length > 0}
      <div class="relative">
        <button
          type="button"
          role="menuitem"
          class={itemClass}
          onpointerenter={() => { showGroupSubmenu = true }}
          onpointerleave={() => { showGroupSubmenu = false }}
        >
          <ArrowsOutCardinal class="w-4 h-4 text-neutral-400" />
          Move to group
          <span class="ml-auto text-neutral-300 dark:text-neutral-600 text-xs">&rsaquo;</span>
        </button>
        {#if showGroupSubmenu}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="absolute left-full top-0 ml-1 min-w-[140px] bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-lg py-1 text-sm"
            role="menu"
            onpointerenter={() => { showGroupSubmenu = true }}
            onpointerleave={() => { showGroupSubmenu = false }}
          >
            {#each groupOptions as opt}
              <button
                type="button"
                role="menuitem"
                class="w-full px-3 py-1.5 text-left text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors truncate {opt.id === undefined ? 'italic text-neutral-400 dark:text-neutral-500' : ''}"
                onclick={() => handleAction(() => onmovetogroup?.(id, opt.id))}
              >
                {opt.label}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <div class="my-1 border-t border-neutral-200 dark:border-neutral-700"></div>

    <button
      type="button"
      role="menuitem"
      class="flex items-center gap-2 w-full px-3 py-1.5 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
      onclick={() => handleAction(() => ondelete?.(id, type))}
    >
      <Trash class="w-4 h-4" />
      Delete
    </button>
  {/if}
</div>
