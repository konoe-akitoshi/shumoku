<script lang="ts">
  import { type NodeSpec, resolveIcon, specDeviceType } from '@shumoku/core'
  import { Handle, type Node, type NodeProps, Position } from '@xyflow/svelte'

  // Custom Svelte Flow node — renders a floor-plan "pin": icon + label.
  // Uses Handle on all four sides so wires can attach naturally from
  // any direction. The wrapping <div> gives DOM-rect hit detection.

  type SceneNodeT = Node<{ label: string; spec?: NodeSpec; isExternal?: boolean }, 'scene'>

  let { data, selected }: NodeProps<SceneNodeT> = $props()

  const icon = $derived(resolveIcon(data.spec))
  const iconSize = 36
  const ariaLabel = $derived(specDeviceType(data.spec) ?? 'icon')
</script>

<div class="flex select-none flex-col items-center" style:opacity={data.isExternal ? 0.6 : 1}>
  <!-- Connection handles on all four sides; visually invisible but
       active for connection authoring. -->
  <Handle type="source" position={Position.Top} style="opacity: 0;" />
  <Handle type="source" position={Position.Right} style="opacity: 0;" />
  <Handle type="source" position={Position.Bottom} style="opacity: 0;" />
  <Handle type="source" position={Position.Left} style="opacity: 0;" />

  <div
    class="relative flex items-center justify-center rounded-full {selected
      ? 'ring-2 ring-blue-500'
      : ''}"
    style:width="{iconSize}px"
    style:height="{iconSize}px"
  >
    {#if icon}
      {#if icon.kind === 'inline'}
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="currentColor"
          role="img"
          aria-label={ariaLabel}
          style:color="#1e293b"
          style="filter: drop-shadow(0 1px 1px rgba(0,0,0,0.25)); pointer-events: none;"
        >
          <title>{ariaLabel}</title>
          {@html icon.svg}
        </svg>
      {:else}
        <img
          src={icon.url}
          alt={ariaLabel}
          width={iconSize}
          height={iconSize}
          style="filter: drop-shadow(0 1px 1px rgba(0,0,0,0.25)); pointer-events: none;"
        >
      {/if}
    {:else}
      <div
        class="rounded-full border border-neutral-400 bg-white"
        style:width="{iconSize - 12}px"
        style:height="{iconSize - 12}px"
      ></div>
    {/if}
  </div>

  {#if data.label}
    <div
      class="mt-0.5 max-w-[160px] truncate rounded-[3px] border border-black/10 bg-white/95 px-1 text-[10px] leading-[14px] text-slate-900"
      style="pointer-events: none;"
    >
      {data.label}
    </div>
  {/if}
</div>
