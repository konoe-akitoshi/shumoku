<script lang="ts">
  import type { LinkOverlayContext } from '@shumoku/renderer'
  import { bezierOffsetPath, polylineOffsetPath } from '@shumoku/renderer'
  import {
    bpsToDurationMs,
    computeLaneGeometry,
    DOWN_COLOR,
    getUtilizationColor,
    type LinkFlowMetrics,
    utilizationToDurationMs,
  } from '$lib/weathermap'

  export type WeathermapAnimation = 'full' | 'reduced' | 'off'

  interface Props {
    context: LinkOverlayContext
    metrics: LinkFlowMetrics | undefined
    enabled?: boolean
    animation?: WeathermapAnimation
  }

  let { context, metrics, enabled = true, animation = 'full' }: Props = $props()

  const active = $derived(enabled && animation !== 'off' && !!metrics)
  const down = $derived(metrics?.status === 'down')
  const inUtil = $derived(metrics?.inUtilization ?? metrics?.utilization ?? 0)
  const outUtil = $derived(metrics?.outUtilization ?? metrics?.utilization ?? 0)
  // Lane geometry is a PURE FUNCTION of the base width — the two lanes
  // partition the stroke so their outer edges land ON the link edge (proven by
  // weathermap-geometry.test.ts). Kept out of the component so it's testable.
  const geom = $derived(computeLaneGeometry(context.width))
  const baseColor = $derived(down ? DOWN_COLOR : getUtilizationColor(Math.max(inUtil, outUtil)))
  const inColor = $derived(down ? DOWN_COLOR : getUtilizationColor(inUtil))
  const outColor = $derived(down ? DOWN_COLOR : getUtilizationColor(outUtil))
  // Prefer bps for animation speed; fall back to utilization% when the
  // data source only reports a percentage (legacy / partial plugins).
  const inDuration = $derived(
    (metrics?.inBps ?? 0) > 0
      ? bpsToDurationMs(metrics?.inBps ?? 0)
      : utilizationToDurationMs(inUtil),
  )
  const outDuration = $derived(
    (metrics?.outBps ?? 0) > 0
      ? bpsToDurationMs(metrics?.outBps ?? 0)
      : utilizationToDurationMs(outUtil),
  )
  // Lane geometry is computed analytically from port positions/sides,
  // so we don't need a mounted SVGPathElement and don't pay for any
  // DOM sampling. When port data is missing (degenerate / non-port
  // edges) we collapse to a single combined overlay — see template —
  // because there's no geometric anchor to split lanes from.
  const hasPorts = $derived(!!(context.fromPort && context.toPort))
  // Split into two directional lanes only when there are ports to anchor the
  // split AND the line is wide enough for two lanes to read. Otherwise one
  // centered lane fills the line (no offset → nothing to overflow).
  const canSplit = $derived(hasPorts && geom.canSplit)
  // Offset a lane's path by `signedOffset` perpendicular to the base path.
  function lanePath(signedOffset: number): string {
    if (context.routePoints && context.routePoints.length >= 2) {
      return polylineOffsetPath(context.routePoints, signedOffset)
    }
    if (hasPorts && context.fromPort && context.toPort) {
      return bezierOffsetPath(context.fromPort, context.toPort, signedOffset)
    }
    return context.pathD
  }
  // The two directional lanes, driven off one geometry source so they can't
  // drift apart (previously two near-identical <path> blocks).
  const lanes = $derived([
    {
      dir: 'in' as const,
      d: lanePath(geom.laneOffset),
      color: inColor,
      duration: inDuration,
    },
    {
      dir: 'out' as const,
      d: lanePath(-geom.laneOffset),
      color: outColor,
      duration: outDuration,
    },
  ])
  // Combined-lane duration for the port-less fallback: pick whichever
  // direction is moving fastest so the user still sees activity.
  const combinedDuration = $derived(
    inDuration > 0 && outDuration > 0
      ? Math.min(inDuration, outDuration)
      : Math.max(inDuration, outDuration),
  )

  $effect(() => {
    // The renderer hands us the link-group element via context, so
    // we don't have to walk the DOM (`closest('g.link-group')`) and
    // re-leak the renderer's class names back into this overlay.
    const group = context.groupElement
    if (!group) return
    if (!active) {
      group.classList.remove('wm-active', 'wm-down')
      group.style.removeProperty('--wm-base-color')
      return
    }
    group.classList.add('wm-active')
    group.classList.toggle('wm-down', down)
    group.style.setProperty('--wm-base-color', baseColor)
    return () => {
      group.classList.remove('wm-active', 'wm-down')
      group.style.removeProperty('--wm-base-color')
    }
  })
</script>

{#if active && !down}
  {#if canSplit}
    {#each lanes as lane (lane.dir)}
      <path
        class="wm-overlay"
        class:wm-static={animation === 'reduced'}
        data-direction={lane.dir}
        d={lane.d}
        style:--wm-color={lane.color}
        style:--wm-width={String(geom.laneWidth)}
        style:--wm-play={lane.duration <= 0 ? 'paused' : 'running'}
        style:--wm-duration={lane.duration <= 0 ? '0ms' : `${lane.duration}ms`}
      />
    {/each}
  {:else}
    <!-- Port-less or too-thin edge: one centered lane fills the line (no
         offset → nothing to overflow). Width tracks the base stroke. -->
    <path
      class="wm-overlay"
      class:wm-static={animation === 'reduced'}
      data-direction="in"
      d={context.pathD}
      style:--wm-color={baseColor}
      style:--wm-width={String(geom.combinedWidth)}
      style:--wm-play={combinedDuration <= 0 ? 'paused' : 'running'}
      style:--wm-duration={combinedDuration <= 0 ? '0ms' : `${combinedDuration}ms`}
    />
  {/if}
{/if}

<style>
  .wm-overlay {
    pointer-events: none;
    fill: none;
    stroke: var(--wm-color, currentColor);
    stroke-width: var(--wm-width, 2);
    stroke-linecap: butt;
    stroke-dasharray: var(--wm-dash, 3 21);
    opacity: var(--wm-opacity, 0.95);
    animation-duration: var(--wm-duration, 2s);
    animation-timing-function: linear;
    animation-iteration-count: infinite;
    animation-play-state: var(--wm-play, paused);
  }

  .wm-overlay[data-direction="in"] {
    animation-name: wm-flow-in;
  }

  .wm-overlay[data-direction="out"] {
    animation-name: wm-flow-out;
  }

  .wm-overlay.wm-static {
    stroke-dasharray: none;
    animation: none;
    opacity: 0.7;
  }

  /* Camera gesture LOD: the dashoffset animations force a full SVG
             repaint every frame (~5fps idle on a 460-node diagram), which
             starves pan/zoom of frame budget — and even a *paused* dashed
             stroke roughly quadruples repaint cost (drag measured 11fps paused
             vs 50fps hidden on the same diagram). attachCamera toggles
             .camera-gesture on the svg while a wheel/drag gesture is active —
             hide the lanes for its duration; the base link keeps its
             utilization tint via `.wm-active > path.link`, so only the moving
             dots vanish mid-gesture. */
  :global(svg.camera-gesture) .wm-overlay {
    display: none;
  }

  :global(.wm-active > path.link) {
    stroke: var(--wm-base-color, currentColor);
    opacity: 0.55;
    transition:
      stroke 200ms ease,
      opacity 200ms ease;
  }

  /* Down: no lane overlay; the base link itself is the indicator —
                                   solid red dashed line, full opacity, so it can never be confused
                                   with the animated red lanes of a 90-100% utilized link. */
  :global(.wm-active.wm-down > path.link) {
    opacity: 1;
    stroke-dasharray: 8 4;
  }

  @keyframes wm-flow-in {
    from {
      stroke-dashoffset: 0;
    }
    to {
      stroke-dashoffset: -24;
    }
  }

  @keyframes wm-flow-out {
    from {
      stroke-dashoffset: 0;
    }
    to {
      stroke-dashoffset: 24;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .wm-overlay {
      stroke-dasharray: none;
      animation: none !important;
      opacity: 0.7;
    }
  }
</style>
