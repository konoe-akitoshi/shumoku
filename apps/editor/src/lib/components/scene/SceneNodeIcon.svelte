<script lang="ts">
  import { getDeviceIcon, type NodeSpec, resolveIcon, specDeviceType } from '@shumoku/core'
  import type { TerminationRole } from '$lib/scene/node-geometry'

  let {
    spec,
    termination,
    selected = false,
    compact = false,
    screenScale = 1,
  }: {
    spec?: NodeSpec
    termination?: { role: TerminationRole }
    selected?: boolean
    compact?: boolean
    screenScale?: number
  } = $props()
  let failedUrl: string | undefined = $state()
  const resolved = $derived(termination ? null : resolveIcon(spec))
  const generic = $derived(getDeviceIcon(specDeviceType(spec)))
  const icon = $derived(compact && generic ? { kind: 'inline' as const, svg: generic } : resolved)
  const ariaLabel = $derived(
    termination
      ? {
          outlet: 'wall outlet',
          eps: 'EPS riser',
          panel: 'patch panel',
          bend: 'wire bend',
        }[termination.role]
      : (specDeviceType(spec) ?? 'device'),
  )
</script>

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
    <!-- Bend: tiny anchor dot. Light gray by default so the user
           can spot the bend (and click it for delete / drag); turns
           solid blue on selection. Hover bumps the contrast a bit
           so the hit target reads from a few feet away. -->
    <div
      class="h-full w-full rounded-full bg-slate-400/40 transition-colors hover:bg-slate-500/70"
      class:!bg-blue-500={selected}
      aria-label={ariaLabel}
    ></div>
  {/if}
{:else}
  <div class="device-frame" class:selected style:--screen-px="{screenScale}px">
    {#if icon && (icon.kind === 'inline' || icon.url !== failedUrl)}
      {#if icon.kind === 'inline'}
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 24 24"
          fill="currentColor"
          role="img"
          aria-label={ariaLabel}
          preserveAspectRatio="xMidYMid meet"
          class="device-icon"
        >
          <title>{ariaLabel}</title>
          {@html icon.svg}
        </svg>
      {:else}
        <img
          src={icon.url}
          draggable={false}
          onerror={() => { failedUrl = icon.url }}
          alt={ariaLabel}
          class="device-icon h-full w-full object-contain"
        >
      {/if}
    {:else}
      <svg viewBox="0 0 24 24" class="h-2/3 w-2/3 text-slate-600" role="img" aria-label={ariaLabel}>
        <title>{ariaLabel}</title>
        <rect
          x="3"
          y="4"
          width="18"
          height="13"
          rx="2"
          fill="white"
          stroke="currentColor"
          stroke-width="1.5"
        />
        <path d="M8 21h8M12 17v4" stroke="currentColor" stroke-width="1.5" />
      </svg>
    {/if}
  </div>
{/if}

<style>
  .device-frame {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    padding: 15%;
    border: var(--screen-px) solid #94a3b8;
    border-radius: calc(6 * var(--screen-px));
    background: #fff;
    box-shadow: 0 var(--screen-px) calc(2 * var(--screen-px)) rgb(15 23 42 / 12%);
  }
  .device-frame.selected {
    border-color: #2563eb;
    outline: calc(2 * var(--screen-px)) solid #93c5fd;
    outline-offset: var(--screen-px);
  }

  .device-icon {
    color: #1e293b;
    pointer-events: none;
  }
</style>
