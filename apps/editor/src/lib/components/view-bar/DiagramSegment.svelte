<script lang="ts">
  import { ImageSquare } from 'phosphor-svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { diagramState } from '$lib/context.svelte'
  import { segmentClass } from './segment'

  // Diagram view button. Clicking switches off any active scene and
  // (if needed) drops the ?scope= search param so the URL reflects
  // the diagram view. Active when no scene is selected.
  let { active = false }: { active?: boolean } = $props()

  function selectDiagram() {
    diagramState.setCurrentScene(null)
    const url = new URL($page.url)
    if (url.searchParams.has('scope')) {
      url.searchParams.delete('scope')
      goto(`${url.pathname}${url.search}`, { replaceState: true, keepFocus: true })
    }
  }
</script>

<button type="button" class={segmentClass(active)} title="Diagram" onclick={selectDiagram}>
  <ImageSquare class="h-3.5 w-3.5 text-neutral-500" />
  <span>Diagram</span>
</button>
