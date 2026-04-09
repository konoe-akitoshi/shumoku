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

  function dismiss() {
    editState.hideContextMenu()
  }
</script>

{#if menu}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="ctx-backdrop" onclick={dismiss} oncontextmenu={(e) => { e.preventDefault(); dismiss() }}></div>
  <menu
    class="ctx-menu"
    role="menu"
    style="top: {menu.y}px; left: {menu.x}px;"
  >
    <li role="none">
      <button role="menuitem" class="ctx-item ctx-item--danger" onclick={handleDelete}>
        Delete
      </button>
    </li>
  </menu>
{/if}

<style>
  .ctx-backdrop {
    position: fixed;
    inset: 0;
    z-index: 30;
    pointer-events: auto;
  }

  .ctx-menu {
    position: absolute;
    z-index: 31;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    padding: 4px 0;
    margin: 0;
    min-width: 120px;
    font-size: 13px;
    pointer-events: auto;
    list-style: none;
  }

  .ctx-item {
    display: block;
    width: 100%;
    padding: 6px 12px;
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;
  }

  .ctx-item:hover {
    background: #f1f5f9;
  }

  .ctx-item--danger {
    color: #dc2626;
  }

  .ctx-item--danger:hover {
    background: #fef2f2;
  }
</style>
