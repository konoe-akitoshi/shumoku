<script lang="ts">
  import type { EditState } from '../../lib/edit-state.svelte'

  let {
    editState,
    oncommit,
  }: {
    editState: EditState
    oncommit?: (portId: string, value: string) => void
  } = $props()

  let inputEl = $state<HTMLInputElement | null>(null)

  const edit = $derived(editState.labelEdit)

  $effect(() => {
    if (edit && inputEl) {
      inputEl.focus()
      inputEl.select()
    }
  })

  function commit() {
    if (!edit) return
    const { portId, value } = edit
    const trimmed = value.trim()
    editState.endLabelEdit()
    if (trimmed) {
      oncommit?.(portId, trimmed)
    }
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') commit()
    else if (e.key === 'Escape') editState.endLabelEdit()
  }
</script>

{#if edit}
  <input
    bind:this={inputEl}
    type="text"
    value={edit.value}
    oninput={(e) => editState.updateLabelValue((e.currentTarget as HTMLInputElement).value)}
    onblur={commit}
    onkeydown={onkeydown}
    style="
      position: absolute;
      top: {edit.screenRect.top}px;
      left: {edit.screenRect.left}px;
      width: {edit.screenRect.width}px;
      height: 18px;
      font-size: 11px;
      padding: 0 4px;
      border: 1.5px solid #3b82f6;
      border-radius: 4px;
      outline: none;
      background: white;
      color: #1e293b;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      z-index: 20;
      pointer-events: auto;
    "
  />
{/if}
