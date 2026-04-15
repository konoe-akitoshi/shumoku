<script lang="ts">
  import { diagramState } from '$lib/context.svelte'
</script>

<div class="h-[calc(100vh-2.5rem)] px-6 py-4">
  <h1 class="text-lg font-semibold text-neutral-800 dark:text-neutral-100 mb-4">Spec Palette</h1>
  <p class="text-sm text-neutral-400 dark:text-neutral-500">
    {diagramState.nodes.size}
    nodes in diagram. Spec management coming soon.
  </p>
</div>
