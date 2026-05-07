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

<style>
  /* The Svelte Flow node wrapper around this bg would otherwise
             swallow clicks (and route them as node clicks, not pane clicks),
             breaking calibration / click-to-place which both rely on
             onPaneClick. Disabling pointer-events on the wrapper lets clicks
             fall through to the pane underneath. */
  :global(.svelte-flow__node.svelte-flow__node-background) {
    pointer-events: none;
  }
</style>
