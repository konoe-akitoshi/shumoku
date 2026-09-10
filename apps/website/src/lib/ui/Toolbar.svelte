<script lang="ts">
  import './ui.css'

  interface Props {
    label: string
    compact?: boolean
    actions: { id: string; label: string; text: string; onclick: () => void; disabled?: boolean }[]
  }
  let { label, actions, compact = false }: Props = $props()
  let focused = $state('')
  const stop = $derived(
    actions.find((a) => a.id === focused && !a.disabled)?.id ??
      actions.find((a) => !a.disabled)?.id,
  )
  function navigate(event: KeyboardEvent & { currentTarget: HTMLDivElement }) {
    if (!(event.target instanceof HTMLButtonElement)) return
    const buttons = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
    ]
    const index = buttons.indexOf(event.target)
    const direction = getComputedStyle(event.currentTarget).direction === 'rtl' ? -1 : 1
    let next = index
    if (event.key === 'ArrowRight') next += direction
    else if (event.key === 'ArrowLeft') next -= direction
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = buttons.length - 1
    else return
    event.preventDefault()
    buttons[(next + buttons.length) % buttons.length]?.focus()
  }
</script>

<div
  class="ui-toolbar"
  class:ui-toolbar--compact={compact}
  role="toolbar"
  aria-label={label}
  tabindex="-1"
  onkeydown={navigate}
>
  {#each actions as action (action.id)}
    <button
      type="button"
      aria-label={action.label}
      title={action.label}
      disabled={action.disabled}
      tabindex={stop === action.id ? 0 : -1}
      onfocus={() => { focused = action.id }}
      onclick={action.onclick}
    >
      {action.text}
    </button>
  {/each}
</div>
