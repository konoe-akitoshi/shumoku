<script lang="ts">
  import { ImageSquare } from 'phosphor-svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { segmentClass } from './segment'

  // Diagram view button. Navigates to /project/[id]/diagram while
  // preserving the current `?focus=<id>` so toggling between view
  // modes keeps the user's drilldown intact.
  let { active = false }: { active?: boolean } = $props()

  function selectDiagram() {
    const url = new URL($page.url)
    const projectId = $page.params.id
    const focus = url.searchParams.get('focus')
    const target = `/project/${projectId}/diagram${focus !== null ? `?focus=${encodeURIComponent(focus)}` : ''}`
    goto(target)
  }
</script>

<button type="button" class={segmentClass(active)} title="Diagram" onclick={selectDiagram}>
  <ImageSquare class="h-3.5 w-3.5 text-neutral-500" />
  <span>Diagram</span>
</button>
