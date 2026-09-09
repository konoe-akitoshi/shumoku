<script lang="ts">
  import type { Snippet } from 'svelte'
  import { type ControlSize, type ControlVariant, controlClass } from './control'
  import DropdownIndicator from './DropdownIndicator.svelte'
  import './ui.css'

  interface Props {
    label: string
    trigger?: Snippet
    children: Snippet
    disabled?: boolean
    icon?: boolean
    variant?: ControlVariant
    size?: ControlSize
    resetKey?: string
    align?: 'start' | 'end'
  }
  let {
    label,
    trigger,
    children,
    disabled = false,
    icon = false,
    variant = 'secondary',
    size = 'default',
    resetKey,
    align = 'end',
  }: Props = $props()
  let element: HTMLDetailsElement | undefined = $state()
  let panel: HTMLDivElement | undefined = $state()
  let shift = $state(0)
  function keepInViewport() {
    if (!element?.open || !panel) return
    const rect = panel.getBoundingClientRect()
    const gutter = Number.parseFloat(getComputedStyle(panel).paddingInlineStart)
    const left = rect.left - shift
    const right = rect.right - shift
    shift = Math.max(
      gutter - left,
      Math.min(0, document.documentElement.clientWidth - gutter - right),
    )
  }
  $effect(() => {
    void resetKey
    if (element) element.open = false
    if (disabled && element) element.open = false
  })
  function outside(event: MouseEvent) {
    if (element && event.target instanceof Node && !element.contains(event.target))
      element.open = false
    else select(event)
  }
  function handleEscape(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !element?.open) return
    const focused = element.contains(document.activeElement)
    element.open = false
    if (focused) element.querySelector('summary')?.focus()
  }
  function select(event: MouseEvent) {
    if (element && event.target instanceof Element && event.target.closest('a,button')) {
      const action = event.target.closest('button')
      element.open = false
      if (action) element.querySelector('summary')?.focus()
    }
  }
</script>

<svelte:window onclick={outside} onkeydown={handleEscape} onresize={keepInViewport} />
<details bind:this={element} ontoggle={keepInViewport}>
  <summary
    class={controlClass(variant, icon ? 'icon' : size)}
    aria-label={label}
    title={label}
    aria-disabled={disabled}
    onclick={(event) => { if (disabled) event.preventDefault() }}
  >
    {#if trigger}
      {@render trigger()}
    {:else}
      {label}<DropdownIndicator />
    {/if}
  </summary>
  {#if !disabled}
    <div
      bind:this={panel}
      style:translate={`${shift}px 0`}
      class="disclosure-panel ui-panel"
      class:align-start={align === 'start'}
      role="group"
      aria-label={label}
    >
      {@render children()}
    </div>
  {/if}
</details>

<style>
  details {
    position: relative;
  }
  summary {
    list-style: none;
  }
  details[open] > summary.ui-control--ghost {
    background: var(--ui-control-active);
    border-color: var(--site-control-line);
  }
  summary::-webkit-details-marker {
    display: none;
  }
  .disclosure-panel {
    position: absolute;
    z-index: 50;
    inset-inline-end: 0;
    inset-block-start: calc(100% + var(--ui-space-2));
    min-inline-size: 12rem;
    max-inline-size: calc(100vw - 2rem);
    padding: var(--ui-space-2);
    box-shadow: 0 0.5rem 1.5rem #0002;
  }
  .disclosure-panel :global(.ui-control),
  .disclosure-panel :global(.ui-nav-link) {
    width: 100%;
    justify-content: flex-start;
    text-align: start;
  }
  .align-start {
    inset-inline-start: 0;
    inset-inline-end: auto;
  }
</style>
