<script lang="ts">
  import type { Snippet } from 'svelte'
  import './ui.css'
  interface Props {
    id: string
    label: string
    items: { value: string; label: string; disabled?: boolean }[]
    value: string
    onselect: (value: string) => void
    children: Snippet<[string]>
  }
  let { id, label, items, value, onselect, children }: Props = $props()
  const selected = $derived(
    items.find((item) => item.value === value && !item.disabled) ??
      items.find((item) => !item.disabled),
  )
  const key = (value: string) => encodeURIComponent(value)
  function navigate(event: KeyboardEvent & { currentTarget: HTMLDivElement }) {
    if (!(event.target instanceof HTMLButtonElement)) return
    const buttons = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
    ]
    const current = buttons.indexOf(event.target)
    const direction = getComputedStyle(event.currentTarget).direction === 'rtl' ? -1 : 1
    let next = current
    if (event.key === 'ArrowRight') next += direction
    else if (event.key === 'ArrowLeft') next -= direction
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = buttons.length - 1
    else return
    event.preventDefault()
    buttons[(next + buttons.length) % buttons.length]?.focus()
  }
</script>

<div class="ui-tabs">
  <div
    class="ui-tab-list ui-scrollbar"
    role="tablist"
    aria-label={label}
    tabindex="-1"
    onkeydown={navigate}
  >
    {#each items as item (item.value)}
      <button
        type="button"
        class="ui-marker"
        role="tab"
        id={`${id}-tab-${key(item.value)}`}
        aria-controls={`${id}-panel-${key(item.value)}`}
        aria-selected={selected?.value === item.value}
        tabindex={selected?.value === item.value ? 0 : -1}
        disabled={item.disabled}
        onclick={() => onselect(item.value)}
        onfocus={() => onselect(item.value)}
      >
        <span class="ui-marker-label">{item.label}</span>
      </button>
    {/each}
  </div>
  {#each items as item (item.value)}
    <div
      role="tabpanel"
      id={`${id}-panel-${key(item.value)}`}
      aria-labelledby={`${id}-tab-${key(item.value)}`}
      tabindex={selected?.value === item.value ? 0 : -1}
      hidden={selected?.value !== item.value}
    >
      {#if selected?.value === item.value}
        {@render children(item.value)}
      {/if}
    </div>
  {/each}
</div>
