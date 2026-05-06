<script lang="ts">
  import { type NodeSpec, resolveIcon, specDeviceType } from '@shumoku/core'
  import {
    Handle,
    type Node,
    type NodeProps,
    NodeResizer,
    NodeToolbar,
    Position,
  } from '@xyflow/svelte'
  import { Trash } from 'phosphor-svelte'

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
      label: string
      spec?: NodeSpec
      isExternal?: boolean
      termination?: Termination
      /** Toolbar callbacks routed back to SceneCanvas. The canvas
       *  owns modal state and undo bookkeeping; the node just
       *  surfaces the action. */
      onOpenRouting?: () => void
      onOpenEpsRouting?: () => void
      onDelete?: () => void
      /** Base (un-scaled) size for this node's role. NodeResizer
       *  reports absolute pixel dimensions; we divide by the base
       *  size to recover a scale multiplier and persist it. */
      baseW?: number
      baseH?: number
      /** Apply a fresh scale multiplier (from resize drag) back
       *  to the source-of-truth metadata. */
      onResizeScale?: (scale: number) => void
    },
    'scene'
  >

  let { data, selected }: NodeProps<SceneNodeT> = $props()

  const termination = $derived(data.termination)
  const icon = $derived(termination ? null : resolveIcon(data.spec))
  const ariaLabel = $derived(
    termination
      ? termination.role === 'outlet'
        ? 'wall outlet'
        : termination.role === 'eps'
          ? 'EPS riser'
          : termination.role === 'panel'
            ? 'patch panel'
            : 'wire bend'
      : (specDeviceType(data.spec) ?? 'icon'),
  )
</script>

<!-- Drag-to-resize handles. NodeResizer feeds new pixel dimensions
     back via `onResizeEnd`; we divide by the role's base size to
     recover a scale multiplier that lives on the node's metadata.
     Aspect ratio is locked so devices stay square and termination
     glyphs keep their proportions. Bends are anonymous waypoints —
     no resizer or toolbar, they should disappear into the line. -->
{#if termination?.role !== 'bend'}
  <NodeResizer
    isVisible={selected}
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
  isVisible={selected && termination?.role !== 'bend'}
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
       a sourcePosition for smoothstep — one identifier, two uses. -->
  <Handle id="top" type="source" position={Position.Top} style="opacity: 0;" />
  <Handle id="right" type="source" position={Position.Right} style="opacity: 0;" />
  <Handle id="bottom" type="source" position={Position.Bottom} style="opacity: 0;" />
  <Handle id="left" type="source" position={Position.Left} style="opacity: 0;" />

  {#if termination}
    <!-- Termination glyphs: small, role-specific shapes. Selected state
         lights the border so editing affordance stays consistent. -->
    {#if termination.role === 'outlet'}
      <div
        class="flex h-full w-full items-center justify-center rounded-[3px] border-[1.5px] bg-white shadow-[0_0_0_1.5px_rgba(255,255,255,0.85),0_1px_2px_rgba(0,0,0,0.2)]"
        class:border-blue-500={selected}
        class:border-neutral-500={!selected}
        aria-label={ariaLabel}
      >
        <div class="h-1.5 w-1.5 rounded-full bg-neutral-700"></div>
        <div class="ml-1 h-1.5 w-1.5 rounded-full bg-neutral-700"></div>
      </div>
    {:else if termination.role === 'eps'}
      <div
        class="flex h-full w-full flex-col justify-around rounded-[2px] border-[1.5px] bg-amber-50 px-0.5 shadow-[0_0_0_1.5px_rgba(255,255,255,0.85),0_1px_2px_rgba(0,0,0,0.2)]"
        class:border-blue-500={selected}
        class:border-amber-500={!selected}
        aria-label={ariaLabel}
      >
        <div class="h-[2px] bg-amber-500"></div>
        <div class="h-[2px] bg-amber-500"></div>
        <div class="h-[2px] bg-amber-500"></div>
      </div>
    {:else if termination.role === 'panel'}
      <div
        class="flex h-full w-full items-center justify-around rounded-[2px] border-[1.5px] bg-slate-100 shadow-[0_0_0_1.5px_rgba(255,255,255,0.85),0_1px_2px_rgba(0,0,0,0.2)]"
        class:border-blue-500={selected}
        class:border-slate-500={!selected}
        aria-label={ariaLabel}
      >
        <div class="h-1.5 w-1.5 rounded-full bg-slate-600"></div>
        <div class="h-1.5 w-1.5 rounded-full bg-slate-600"></div>
        <div class="h-1.5 w-1.5 rounded-full bg-slate-600"></div>
      </div>
    {:else}
      <!-- Bend: tiny anchor dot. Only visible when selected so the
           wire reads cleanly in the default state; selected state
           gives the user something to grab for fine adjustments. -->
      <div
        class="h-full w-full rounded-full transition-colors"
        class:bg-blue-500={selected}
        class:bg-transparent={!selected}
        aria-label={ariaLabel}
      ></div>
    {/if}
  {:else}
    <div
      class="flex h-full w-full items-center justify-center {selected
        ? 'rounded-sm ring-2 ring-blue-500'
        : ''}"
    >
      {#if icon}
        {#if icon.kind === 'inline'}
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 24 24"
            fill="currentColor"
            role="img"
            aria-label={ariaLabel}
            preserveAspectRatio="xMidYMid meet"
            style:color="#1e293b"
            style="filter: drop-shadow(0 0 1.5px white) drop-shadow(0 0 1.5px white) drop-shadow(0 1px 1px rgba(0,0,0,0.3)); pointer-events: none;"
          >
            <title>{ariaLabel}</title>
            {@html icon.svg}
          </svg>
        {:else}
          <img
            src={icon.url}
            alt={ariaLabel}
            class="h-full w-full object-contain"
            style="filter: drop-shadow(0 0 1.5px white) drop-shadow(0 0 1.5px white) drop-shadow(0 1px 1px rgba(0,0,0,0.3)); pointer-events: none;"
          >
        {/if}
      {:else}
        <div class="h-2/3 w-2/3 rounded-full border border-neutral-400 bg-white"></div>
      {/if}
    </div>
  {/if}

  {#if data.label}
    <!-- Label floats beneath the icon, absolutely positioned so it
         doesn't extend the node's hit area — handles + wires stay
         locked to the icon. -->
    <div
      class="absolute left-1/2 top-full max-w-[160px] -translate-x-1/2 truncate rounded-[3px] border border-black/15 bg-white px-1 text-[10px] leading-[14px] text-slate-900"
      style="margin-top: 2px; pointer-events: none; box-shadow: 0 0 0 1.5px rgba(255,255,255,0.9), 0 1px 2px rgba(0,0,0,0.2);"
    >
      {data.label}
    </div>
  {/if}
</div>
