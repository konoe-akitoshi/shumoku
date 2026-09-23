<script lang="ts">
  import type { NodeSpec } from '@shumoku/core'
  import {
    Handle,
    type Node,
    type NodeProps,
    NodeResizer,
    NodeToolbar,
    Position,
  } from '@xyflow/svelte'
  import { ArrowsOut, PencilSimple, Trash } from 'phosphor-svelte'
  import { editorState } from '$lib/context.svelte'
  import SceneNodeIcon from './SceneNodeIcon.svelte'
  import SceneNodeLabel from './SceneNodeLabel.svelte'

  // Custom Svelte Flow node — renders a floor-plan "pin". Two visual
  // modes share the same component:
  //   - device:      icon + label (the default)
  //   - termination: small role-specific glyph for outlets / EPS /
  //                  patch panels (passive cable transit points)
  // Both expose the same 4-handle layout so wires connect identically.
  //
  // Sizing is driven by Svelte Flow: SceneCanvas hands the library
  // `Node.width`/`Node.height` per-node, and the framework applies
  // them to the wrapper div. We just fill the wrapper with `w-full
  // h-full`, so per-node / per-scene scale is a one-source-of-truth
  // computation in the canvas, not duplicated here.

  type Termination = { role: 'outlet' | 'eps' | 'panel' | 'bend' }
  type SceneNodeT = Node<
    {
      /** Display label (may include a cross-boundary suffix). */
      label: string
      /** Raw label without display decorations — what rename writes back. */
      editableLabel?: string
      spec?: NodeSpec
      isExternal?: boolean
      termination?: Termination
      /** Toolbar callbacks routed back to SceneCanvas. The canvas
       *  owns modal state and undo bookkeeping; the node just
       *  surfaces the action. */
      onOpenRouting?: () => void
      onOpenEpsRouting?: () => void
      onDelete?: () => void
      /** Inline rename — writes back to `Node.label` so Diagram /
       *  Connections views also pick up the change. Undefined for
       *  bends (they're anonymous waypoints). */
      onRename?: (label: string) => void
      /** Base (un-scaled) size for this node's role. NodeResizer
       *  reports absolute pixel dimensions; we divide by the base
       *  size to recover a scale multiplier and persist it. */
      baseW?: number
      baseH?: number
      /** Inverse viewport zoom for the active label editor and selection outline. */
      interactionScale?: number
      /** Apply a fresh scale multiplier (from resize drag) back
       *  to the source-of-truth metadata. */
      onResizeScale?: (scale: number) => void
    },
    'scene'
  >

  let { data, selected, width }: NodeProps<SceneNodeT> = $props()
  let labelComponent: SceneNodeLabel | undefined = $state()
  const interactive = $derived(editorState.interactive)
  let resizing = $state(false)
  $effect(() => {
    if (!selected || !interactive) resizing = false
  })
  const termination = $derived(data.termination)
</script>

<!-- Drag-to-resize handles. NodeResizer feeds new pixel dimensions
     back via `onResizeEnd`; we divide by the role's base size to
     recover a scale multiplier that lives on the node's metadata.
     Aspect ratio is locked so devices stay square and termination
     glyphs keep their proportions. Bends are anonymous waypoints —
     no resizer or toolbar, they should disappear into the line. -->
{#if interactive && data.onResizeScale && termination?.role !== 'bend'}
  <NodeResizer
    isVisible={selected && resizing}
    keepAspectRatio
    minWidth={(data.baseW ?? 36) * 0.4}
    minHeight={(data.baseH ?? 36) * 0.4}
    maxWidth={(data.baseW ?? 36) * 6}
    maxHeight={(data.baseH ?? 36) * 6}
    lineStyle="border-color: rgba(59, 130, 246, 0.4);"
    handleStyle="background: white; border: 1px solid #3b82f6; width: 8px; height: 8px;"
    onResizeEnd={(_e, params) => {
      const baseW = data.baseW
      if (!baseW || baseW <= 0) return
      const scale = params.width / baseW
      data.onResizeScale?.(scale)
    }}
  />
{/if}

<!-- Floating contextual toolbar — visible while this node is the
     selection. Buttons fan out by role: device pins get the wire-
     routing dialog; EPS chases get their own multi-source picker.
     Both kinds get Delete. Bends are too small to host a toolbar
     and don't have meaningful actions beyond delete (which works
     via Backspace anyway). -->
<NodeToolbar
  isVisible={interactive && selected && termination?.role !== 'bend'}
  position={Position.Top}
  offset={8}
>
  <div
    class="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-1.5 py-1 shadow-md dark:border-neutral-700 dark:bg-neutral-800"
  >
    {#if termination?.role === 'eps'}
      <button
        type="button"
        class="rounded px-2 py-0.5 text-[11px] text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-700"
        onclick={() => data.onOpenEpsRouting?.()}
      >
        Wires through…
      </button>
    {:else if !termination}
      <button
        type="button"
        class="rounded px-2 py-0.5 text-[11px] text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-700"
        onclick={() => data.onOpenRouting?.()}
      >
        Routing…
      </button>
    {/if}
    {#if data.onRename}
      <button
        type="button"
        class="flex h-6 w-6 items-center justify-center rounded text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-700 dark:hover:text-neutral-100"
        onclick={() => labelComponent?.startRename()}
        aria-label="Rename"
        title="Rename"
      >
        <PencilSimple class="h-3.5 w-3.5" />
      </button>
    {/if}
    {#if data.onResizeScale}
      <button
        type="button"
        class="flex h-6 w-6 items-center justify-center rounded text-neutral-500 hover:bg-neutral-100"
        aria-label="Resize node"
        aria-pressed={resizing}
        title="Resize node"
        onclick={() => { resizing = !resizing }}
      >
        <ArrowsOut class="h-3.5 w-3.5" />
      </button>
    {/if}
    <button
      type="button"
      class="flex h-6 w-6 items-center justify-center rounded text-neutral-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
      onclick={() => data.onDelete?.()}
      aria-label="Delete"
    >
      <Trash class="h-3.5 w-3.5" />
    </button>
  </div>
</NodeToolbar>

<div class="relative h-full w-full select-none" style:opacity={data.isExternal ? 0.6 : 1}>
  <!-- Handles anchor to the box's four sides so wires terminate at the
       icon (or termination glyph) and don't pass through the label.
       Handle ids match Position values so picking a side ('top' /
       'right' / 'bottom' / 'left') gives both a sourceHandle id and
       a sourcePosition for smoothstep — one identifier, two uses.
       Bends are anonymous waypoints inside an existing wire — they
       must NOT be valid wire endpoints (would let users drag a new
       wire out of a bend point), so they get no handles. -->
  {#if termination?.role !== 'bend'}
    <Handle id="top" type="source" position={Position.Top} style="opacity: 0;" />
    <Handle id="right" type="source" position={Position.Right} style="opacity: 0;" />
    <Handle id="bottom" type="source" position={Position.Bottom} style="opacity: 0;" />
    <Handle id="left" type="source" position={Position.Left} style="opacity: 0;" />
  {/if}

  <SceneNodeIcon
    spec={data.spec}
    {termination}
    {selected}
    screenScale={data.interactionScale ?? 1}
  />
  {#if termination?.role !== 'bend'}
    <SceneNodeLabel
      bind:this={labelComponent}
      label={data.label}
      editableLabel={data.editableLabel}
      editScale={data.interactionScale ?? 1}
      drawingScale={Math.max(0.5, Math.min(2, (width ?? 52) / 52))}
      onRename={interactive ? data.onRename : undefined}
    />
  {/if}
</div>
