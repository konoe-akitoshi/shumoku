<script lang="ts">
  import { diagramState } from '$lib/context.svelte'
  import { movePicker } from '$lib/state/move-picker.svelte'

  // Popover that lists every subgraph as a target for the "Move to
  // group" action. Replaces the submenu that the old NodeContextMenu
  // had — the new flat CanvasContextMenu can't nest, so the action
  // opens this picker as a follow-up step.
  //
  // The first option is always "(top level)" so the user can unwrap
  // a node out of its current group. We hide whichever subgraph the
  // node is already in — moving to the same group would be a no-op
  // and just clutters the list.

  const request = $derived(movePicker.request)
  const subgraphs = $derived(Array.from(diagramState.subgraphs.values()))
  const currentParent = $derived.by(() => {
    if (!request) return undefined
    const node = diagramState.nodes.get(request.nodeId)
    return node?.parent
  })
  const options = $derived(subgraphs.filter((sg) => sg.id !== currentParent))

  async function pick(targetSubgraphId: string | undefined) {
    if (!request) return
    // Capture nodeId BEFORE close — `request` is a $derived read of
    // movePicker.request, and closing flips that to null. Reading
    // `request.nodeId` afterward would throw and the move would
    // silently swallow inside the unhandled promise.
    const nodeId = request.nodeId
    movePicker.close()
    await diagramState.moveNodeToGroup(nodeId, targetSubgraphId)
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') movePicker.close()
  }
</script>

{#if request}
  <!-- Click-catcher behind the popover so any outside click closes
       it. svelte-flow's pane click is captured by Svelte Flow first
       in scene mode, so we don't rely on that — this overlay is the
       single source of truth for "click anywhere else closes me". -->
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-40" onclick={() => movePicker.close()}></div>

  <div
    class="fixed z-50 w-52 rounded-lg border border-slate-200 bg-white text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
    style="top: {request.y}px; left: {request.x}px"
    role="menu"
    tabindex="-1"
    {onkeydown}
  >
    <div
      class="border-b border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-600 dark:border-neutral-700 dark:text-neutral-400"
    >
      Move to group
    </div>
    <ul class="max-h-64 overflow-auto py-1">
      <li>
        <button
          type="button"
          class="flex w-full items-center justify-between px-3 py-1.5 text-left text-slate-900 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-700"
          onclick={() => pick(undefined)}
          disabled={currentParent === undefined}
        >
          <span class="italic text-slate-500 dark:text-neutral-400">(top level)</span>
        </button>
      </li>
      {#if options.length === 0}
        <li class="px-3 py-1.5 text-[11px] text-slate-500 dark:text-neutral-400">
          No other groups
        </li>
      {:else}
        {#each options as sg (sg.id)}
          <li>
            <button
              type="button"
              class="flex w-full items-center px-3 py-1.5 text-left text-slate-900 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-700"
              onclick={() => pick(sg.id)}
            >
              <span class="truncate">{sg.label ?? sg.id}</span>
            </button>
          </li>
        {/each}
      {/if}
    </ul>
  </div>
{/if}
