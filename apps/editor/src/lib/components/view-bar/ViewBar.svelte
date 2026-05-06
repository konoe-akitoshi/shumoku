<script lang="ts">
  import { page } from '$app/stores'
  import DiagramSegment from './DiagramSegment.svelte'
  import HierarchySegment from './HierarchySegment.svelte'
  import SceneSegment from './SceneSegment.svelte'

  // Bottom-center segmented control. Three roles split out:
  //   Hierarchy  — pick which sheet (subgraph) to drill into; shared
  //                between diagram and scene views via `?focus=`.
  //   Diagram    — switch to /project/[id]/diagram.
  //   Scene      — switch to /project/[id]/scene.
  // Active state lights one of Diagram / Scene based on the URL
  // pathname so reload / back-forward stay in sync.
  const sceneActive = $derived($page.url.pathname.endsWith('/scene'))
</script>

<div
  class="flex items-center gap-1 rounded-xl border border-neutral-200 bg-neutral-100/80 p-1 shadow-lg backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-900/70"
>
  <DiagramSegment active={!sceneActive} />
  <SceneSegment active={sceneActive} />
  <span class="h-4 w-px bg-neutral-300 dark:bg-neutral-700" aria-hidden="true"></span>
  <HierarchySegment />
</div>
