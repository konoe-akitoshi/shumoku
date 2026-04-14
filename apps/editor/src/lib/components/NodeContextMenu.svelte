<script lang="ts">
  import { ClipboardText, Copy, Trash } from 'phosphor-svelte'

  let {
    id,
    type,
    x,
    y,
    hasClipboard = false,
    oncopy,
    onpaste,
    ondelete,
    onclose,
  }: {
    id: string
    type: string
    x: number
    y: number
    hasClipboard?: boolean
    oncopy?: (id: string, type: string) => void
    onpaste?: (x: number, y: number) => void
    ondelete?: (id: string, type: string) => void
    onclose?: () => void
  } = $props()

  function handleAction(action: () => void) {
    action()
    onclose?.()
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-40"
  onclick={() => onclose?.()}
  oncontextmenu={(e) => { e.preventDefault(); onclose?.() }}
></div>
<div
  class="fixed z-50 min-w-[160px] bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg py-1 text-sm"
  style="top: {y}px; left: {x}px;"
  role="menu"
>
  <div
    class="px-3 py-1.5 text-xs text-neutral-400 dark:text-neutral-500 font-medium uppercase tracking-wider"
  >
    {type}
  </div>

  {#if type === 'node' || type === 'subgraph'}
    <button
      type="button"
      role="menuitem"
      class="flex items-center gap-2 w-full px-3 py-1.5 text-left text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
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
      class="flex items-center gap-2 w-full px-3 py-1.5 text-left text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
      onclick={() => handleAction(() => onpaste?.(x, y))}
    >
      <ClipboardText class="w-4 h-4 text-neutral-400" />
      Paste here
    </button>
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
</div>
