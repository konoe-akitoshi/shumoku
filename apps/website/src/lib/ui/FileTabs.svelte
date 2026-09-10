<script lang="ts">
  import { X } from '@lucide/svelte'
  import { type Snippet, tick } from 'svelte'
  import { horizontalWheel } from './horizontal-wheel'
  import { revealHorizontal } from './reveal-horizontal.svelte'
  import './ui.css'
  import './file-tabs.css'

  let {
    id,
    label,
    items,
    value,
    onselect,
    onclose,
    closeLabel = (name: string) => `Close ${name}`,
    children,
  }: {
    id: string
    label: string
    items: { value: string; label: string; closable?: boolean }[]
    value: string
    onselect: (value: string) => void
    onclose: (value: string) => void
    closeLabel?: (value: string) => string
    children: Snippet<[string]>
  } = $props()
  let strip: HTMLDivElement | undefined = $state()
  const key = (name: string) => encodeURIComponent(name)
  const revealSelection = revealHorizontal((container) => {
    if (!items.some((item) => item.value === value)) return null
    return container.querySelector<HTMLElement>('[aria-selected="true"]')?.parentElement ?? null
  })
  async function close(name: string) {
    onclose(name)
    await tick()
    strip?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus({ preventScroll: true })
  }
  function navigate(event: KeyboardEvent, index: number) {
    let next = index
    if (event.key === 'ArrowRight') next++
    else if (event.key === 'ArrowLeft') next--
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    else return
    event.preventDefault()
    const item = items[Math.min(items.length - 1, Math.max(0, next))]
    if (!item) return
    onselect(item.value)
    strip
      ?.querySelector<HTMLElement>(`[id="${id}-tab-${key(item.value)}"]`)
      ?.focus({ preventScroll: true })
  }
</script>

<div class="ui-file-tabs">
  <div
    class="ui-file-tab-list ui-scrollbar ui-scrollbar--quiet"
    role="tablist"
    aria-label={label}
    bind:this={strip}
    {@attach revealSelection}
    {@attach horizontalWheel}
  >
    {#each items as item, index (item.value)}
      <div class="ui-file-tab" role="presentation" class:active={value === item.value}>
        <button
          type="button"
          role="tab"
          id={`${id}-tab-${key(item.value)}`}
          aria-controls={`${id}-panel`}
          aria-selected={value === item.value}
          aria-label={item.label}
          tabindex={value === item.value ? 0 : -1}
          title={item.label}
          onclick={() => onselect(item.value)}
          onkeydown={(event) => navigate(event, index)}
        >
          <span class="ui-file-label">{item.label}</span>
        </button>
        <button
          type="button"
          class="ui-file-close"
          aria-label={closeLabel(item.label)}
          title={closeLabel(item.label)}
          disabled={item.closable === false}
          tabindex={value === item.value ? 0 : -1}
          onclick={() => { void close(item.value) }}
        >
          <X class="ui-file-close-icon" aria-hidden="true" />
        </button>
      </div>
    {/each}
  </div>
  {#if items.some(item => item.value === value)}
    <div
      class="ui-file-panel"
      role="tabpanel"
      id={`${id}-panel`}
      aria-labelledby={`${id}-tab-${key(value)}`}
    >
      {@render children(value)}
    </div>
  {:else}
    <p class="ui-file-empty">No files</p>
  {/if}
</div>
