<script lang="ts">
  import { type NodeSpec, resolveIcon, specDeviceType } from '@shumoku/core'
  import { Handle, type Node, type NodeProps, Position } from '@xyflow/svelte'
  import { sceneNodeSize } from '$lib/scene/node-geometry'

  // Custom Svelte Flow node — renders a floor-plan "pin". Two visual
  // modes share the same component:
  //   - device:      icon + label (the default)
  //   - termination: small role-specific glyph for outlets / EPS /
  //                  patch panels (passive cable transit points)
  // Both expose the same 4-handle layout so wires connect identically.

  type Termination = { role: 'outlet' | 'eps' | 'panel' }
  type SceneNodeT = Node<
    {
      label: string
      spec?: NodeSpec
      isExternal?: boolean
      termination?: Termination
      /** Per-scene size multiplier from Scene.display.nodeScale. */
      scale?: number
    },
    'scene'
  >

  let { data, selected }: NodeProps<SceneNodeT> = $props()

  const termination = $derived(data.termination)
  const icon = $derived(termination ? null : resolveIcon(data.spec))
  // Base sizes come from the shared geometry module; the per-scene
  // scale multiplier (from Scene.display.nodeScale) is applied here
  // and matched in SceneCanvas's centerOf so wires still aim true.
  const baseSize = $derived(sceneNodeSize({ termination }))
  const scale = $derived(data.scale ?? 1)
  const sizes = $derived({ w: baseSize.w * scale, h: baseSize.h * scale })
  const ariaLabel = $derived(
    termination
      ? termination.role === 'outlet'
        ? 'wall outlet'
        : termination.role === 'eps'
          ? 'EPS riser'
          : 'patch panel'
      : (specDeviceType(data.spec) ?? 'icon'),
  )
</script>

<div
  class="relative select-none"
  style:width="{sizes.w}px"
  style:height="{sizes.h}px"
  style:opacity={data.isExternal ? 0.6 : 1}
>
  <!-- Handles anchor to the box's four sides so wires terminate at the
       icon (or termination glyph) and don't pass through the label. -->
  <!-- Handle ids match Position values so picking a side ('top' /
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
    {:else}
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
    {/if}
  {:else}
    <div
      class="flex h-full w-full items-center justify-center rounded-full {selected
        ? 'ring-2 ring-blue-500'
        : ''}"
    >
      {#if icon}
        {#if icon.kind === 'inline'}
          <svg
            width={sizes.w}
            height={sizes.h}
            viewBox="0 0 24 24"
            fill="currentColor"
            role="img"
            aria-label={ariaLabel}
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
            width={sizes.w}
            height={sizes.h}
            style="filter: drop-shadow(0 0 1.5px white) drop-shadow(0 0 1.5px white) drop-shadow(0 1px 1px rgba(0,0,0,0.3)); pointer-events: none;"
          >
        {/if}
      {:else}
        <div
          class="rounded-full border border-neutral-400 bg-white"
          style:width="{sizes.w - 12}px"
          style:height="{sizes.h - 12}px"
        ></div>
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
