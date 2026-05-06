<script lang="ts">
  import { diagramState } from '$lib/context.svelte'
  import DiagramSegment from './DiagramSegment.svelte'
  import HierarchySegment from './HierarchySegment.svelte'
  import SceneSegment from './SceneSegment.svelte'

  // Bottom-center segmented control. Three roles split out:
  //   Hierarchy  — pick which sheet (subgraph) to drill into for the
  //                diagram canvas.
  //   Diagram    — switch the canvas to the diagram view.
  //   Scene      — switch the canvas to a scene view, with a scope
  //                picker dropdown.
  // Active state lights one of Diagram / Scene depending on whether
  // a scene is selected.
  const sceneActive = $derived(diagramState.currentSceneId !== null)
</script>

<div
  class="flex items-center gap-1 rounded-xl border border-neutral-200 bg-neutral-100/80 p-1 shadow-lg backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-900/70"
>
  <HierarchySegment />
  <span class="h-4 w-px bg-neutral-300 dark:bg-neutral-700" aria-hidden="true"></span>
  <DiagramSegment active={!sceneActive} />
  <SceneSegment active={sceneActive} />
</div>
