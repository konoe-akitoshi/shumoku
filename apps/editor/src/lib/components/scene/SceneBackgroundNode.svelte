<script lang="ts">
  import type { Node, NodeProps } from '@xyflow/svelte'

  // Floor-plan image rendered as a Svelte Flow node so the viewport
  // transform applies naturally — no separate ViewportPortal layer
  // to keep in sync. Non-interactive (no drag, no select, no
  // handles); sits behind everything via zIndex.

  type BgNodeT = Node<{ src: string; width: number; height: number }, 'background'>
  let { data }: NodeProps<BgNodeT> = $props()
</script>

<img
  src={data.src}
  alt="floor plan"
  width={data.width}
  height={data.height}
  draggable={false}
  style="display: block; width: {data.width}px; height: {data.height}px; pointer-events: none; user-select: none;"
>
