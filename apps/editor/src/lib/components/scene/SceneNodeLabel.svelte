<script lang="ts">
  import { Tooltip } from 'bits-ui'
  import { tick } from 'svelte'

  let {
    label,
    editableLabel,
    editScale = 1,
    drawingScale = 1,
    onRename,
  }: {
    label: string
    editableLabel?: string
    editScale?: number
    drawingScale?: number
    onRename?: (label: string) => void
  } = $props()

  let editing = $state(false)
  let editValue = $state('')
  let inputEl: HTMLInputElement | undefined = $state()
  let triggerEl: HTMLButtonElement | null = $state(null)
  const scale = $derived(editing ? editScale : drawingScale)

  export async function startRename() {
    if (!onRename || editing) return
    editValue = editableLabel ?? label
    editing = true
    await tick()
    inputEl?.focus()
    inputEl?.select()
  }

  async function finishRename(commit: boolean, restoreFocus = false) {
    if (!editing) return
    editing = false
    const next = editValue.trim()
    if (commit && next !== (editableLabel ?? label)) onRename?.(next)
    if (restoreFocus) {
      await tick()
      triggerEl?.focus()
    }
  }

  function onRenameKey(event: KeyboardEvent) {
    // Keep editing shortcuts (including Backspace) away from canvas handlers.
    event.stopPropagation()
    // keyCode covers Safari's composition-ending Enter event.
    if (event.isComposing || event.keyCode === 229) return
    if (event.key === 'Enter' || event.key === 'Escape') {
      event.preventDefault()
      void finishRename(event.key === 'Enter', true)
    }
  }
</script>

<div class="label-anchor" style:transform="translateX(-50%) scale({scale})">
  {#if editing}
    <input
      bind:this={inputEl}
      bind:value={editValue}
      class="label-chip label-input nodrag nopan"
      aria-label="Node name"
      type="text"
      autocomplete="off"
      onkeydown={onRenameKey}
      onblur={() => finishRename(true)}
    >
  {:else if label || onRename}
    <Tooltip.Root>
      <Tooltip.Trigger
        bind:ref={triggerEl}
        class="label-chip label-trigger nodrag nopan"
        aria-label={onRename ? `Rename ${label || 'node'}` : label}
        ondblclick={(event) => {
          event.stopPropagation()
          void startRename()
        }}
        onkeydown={(event) => {
          if (onRename && ['Enter', ' ', 'F2'].includes(event.key)) {
            event.preventDefault()
            event.stopPropagation()
            void startRename()
          }
        }}
      >
        {label || 'Unnamed'}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="bottom"
          sideOffset={6}
          class="z-[100] max-w-xs break-words rounded bg-neutral-900 px-2 py-1 text-xs text-white shadow-lg"
        >
          {label || 'Unnamed'}
          {#if onRename}
            <span class="block text-neutral-300">Double-click or press Enter to rename</span>
          {/if}
          <Tooltip.Arrow />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  {/if}
</div>

<style>
  .label-anchor {
    position: absolute;
    left: 50%;
    top: 100%;
    padding-top: 3px;
    transform-origin: top center;
    width: max-content;
  }

  /* Authored drawing text scales with the scene. Only the editor stays screen-sized. */
  .label-anchor :global(.label-chip) {
    display: block;
    box-sizing: border-box;
    max-width: 180px;
    padding: 0 2px;
    border: 1px solid transparent;
    border-radius: 0;
    background: transparent;
    text-shadow:
      0 0 2px white,
      0 0 2px white;
    color: #0f172a;
    font: inherit;
    font-size: 12px;
    line-height: 1.4;
  }

  .label-anchor :global(.label-trigger) {
    white-space: normal;
    overflow-wrap: anywhere;
    text-align: center;
    cursor: default;
  }

  .label-anchor :global(.label-chip:focus-visible),
  .label-input {
    outline: 2px solid #3b82f6;
    outline-offset: 1px;
  }

  .label-anchor :global(.label-trigger:hover),
  .label-anchor :global(.label-trigger:focus-visible) {
    background: white;
    border-color: #cbd5e1;
  }

  .label-anchor .label-input {
    padding: 3px 5px;
    background: white;
    text-shadow: none;
    max-width: 180px;
    width: 180px;
  }
</style>
