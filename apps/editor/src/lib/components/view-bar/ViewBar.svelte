<script lang="ts">
  import { page } from '$app/stores'
  import DiagramSegment from './DiagramSegment.svelte'
  import HierarchySegment from './HierarchySegment.svelte'
  import MapSegment from './MapSegment.svelte'

  const mapActive = $derived($page.url.pathname.endsWith('/map'))
</script>

<div
  data-print-hide
  class="flex items-center gap-1 rounded-xl border border-neutral-200 bg-neutral-100/80 p-1 shadow-lg backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-900/70"
>
  <DiagramSegment active={!mapActive} />
  <MapSegment active={mapActive} />
  {#if !mapActive}
    <span class="h-4 w-px bg-neutral-300 dark:bg-neutral-700" aria-hidden="true"></span>
    <HierarchySegment />
  {/if}
</div>
