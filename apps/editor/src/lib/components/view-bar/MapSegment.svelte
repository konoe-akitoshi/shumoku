<script lang="ts">
  import { MapPin } from 'phosphor-svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { segmentClass } from './segment'

  let { active = false }: { active?: boolean } = $props()
</script>
<button
  type="button"
  class={segmentClass(active)}
  title="Map"
  onclick={() => goto(`/project/${$page.params.id}/map`)}
>
  <MapPin class="h-3.5 w-3.5 text-amber-500" /><span>Map</span>
</button>
