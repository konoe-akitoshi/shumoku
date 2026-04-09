<script lang="ts">
  import type { EditState } from '../../lib/edit-state.svelte'

  let {
    editState,
    ondelete,
  }: {
    editState: EditState
    ondelete?: (targetId: string, targetType: 'node' | 'port' | 'edge') => void
  } = $props()

  const menu = $derived(editState.contextMenu)

  function handleDelete() {
    if (!menu) return
    ondelete?.(menu.targetId, menu.targetType)
    editState.hideContextMenu()
  }
</script>

{#if menu}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    style="
      position: fixed;
      inset: 0;
      z-index: 30;
      pointer-events: auto;
    "
    onclick={() => editState.hideContextMenu()}
    oncontextmenu={(e) => { e.preventDefault(); editState.hideContextMenu() }}
  ></div>
  <div
    style="
      position: absolute;
      top: {menu.y}px;
      left: {menu.x}px;
      z-index: 31;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.12);
      padding: 4px 0;
      min-width: 120px;
      font-size: 13px;
      pointer-events: auto;
    "
  >
    <button
      style="
        display: block;
        width: 100%;
        padding: 6px 12px;
        border: none;
        background: none;
        text-align: left;
        cursor: pointer;
        color: #dc2626;
      "
      onpointerenter={(e) => { (e.currentTarget as HTMLElement).style.background = '#fef2f2' }}
      onpointerleave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none' }}
      onclick={handleDelete}
    >
      Delete
    </button>
  </div>
{/if}
