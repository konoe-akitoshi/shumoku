<script lang="ts">
  import { MapPin } from 'phosphor-svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { diagramState } from '$lib/context.svelte'
  import { isPhysicalSubgraph } from '$lib/scene/scope'
  import { segmentClass } from './segment'

  // Scene view button. The scope is whatever the Hierarchy segment
  // has currently focused — Hierarchy is the single picker for "which
  // subgraph". Clicking Scene opens (or creates) the floor-plan view
  // for that subgraph and persists `?scope=<id>` in the URL so reload
  // restores the same view.
  let { active = false }: { active?: boolean } = $props()

  const sheetId = $derived(diagramState.currentSheetId)
  const subgraph = $derived(sheetId ? diagramState.subgraphs.get(sheetId) : undefined)
  // Scene view only makes sense for physical subgraphs (a logical
  // service group has no floor plan). Disable the button when the
  // currently-focused sheet is logical.
  const allowed = $derived(!subgraph || isPhysicalSubgraph(subgraph))

  function selectScene() {
    if (!allowed) return
    diagramState.setCurrentSceneForScope(sheetId ?? undefined)
    const url = new URL($page.url)
    url.searchParams.set('scope', sheetId ?? '')
    goto(`${url.pathname}${url.search}`, { replaceState: true, keepFocus: true })
  }
</script>

<button
  type="button"
  class={segmentClass(active)}
  title={allowed ? 'Scene' : 'Scene view is only available for physical subgraphs'}
  disabled={!allowed}
  onclick={selectScene}
>
  <MapPin class="h-3.5 w-3.5 {allowed ? 'text-amber-500' : 'text-neutral-400'}" />
  <span>Scene</span>
</button>
