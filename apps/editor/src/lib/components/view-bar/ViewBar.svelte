<script lang="ts">
  import { diagramState } from '$lib/context.svelte'
  import SceneSegment from './SceneSegment.svelte'
  import SheetSegment from './SheetSegment.svelte'

  // Bottom-center segmented control for view selection. Two segments:
  //   Diagram  — sheet (hierarchy) drill-down
  //   Scene    — physical-realization views
  // The active segment renders as a white "card" inside a gray pill,
  // matching the floating-toolbar aesthetic used elsewhere.
  const sceneActive = $derived(diagramState.currentSceneId !== null)
</script>

<div
  class="flex items-center gap-1 rounded-xl border border-neutral-200 bg-neutral-100/80 p-1 shadow-lg backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-900/70"
>
  <SheetSegment active={!sceneActive} />
  <SceneSegment active={sceneActive} />
</div>
