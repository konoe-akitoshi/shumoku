<script lang="ts">
  import type { LinkOverlayContext } from '@shumoku/renderer'
  import { bezierOffsetPath } from '@shumoku/renderer'
  import {
    bpsToDurationMs,
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
  // Lane geometry: keep half-stroke + a 0.5px gap between lanes so the
  // two colored streams never collide regardless of `context.width`.
  // The previous `width/4` offset overlapped at width ≤ 4, masking the
  // in lane behind the out lane.
  const LANE_GAP = 0.5
  const laneWidth = $derived(Math.max(context.width / 2, 2))
  const laneOffset = $derived(laneWidth / 2 + LANE_GAP)
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
  // Routed (octilinear polyline) edges: the flow dashes must follow the
  // routed path, not a port-to-port Bezier — otherwise every routed link
  // grows a phantom diagonal dash line across the diagram. Polyline path
  // data contains no 'C' command; both lanes share the path, and the
  // opposite dash directions keep in/out distinguishable.
  const isRoutedPolyline = $derived(!context.pathD.includes('C'))
  const inPathD = $derived(
    !isRoutedPolyline && hasPorts && context.fromPort && context.toPort
      ? bezierOffsetPath(context.fromPort, context.toPort, laneOffset)
      : context.pathD,
  )
  const outPathD = $derived(
    !isRoutedPolyline && hasPorts && context.fromPort && context.toPort
      ? bezierOffsetPath(context.fromPort, context.toPort, -laneOffset)
      : context.pathD,
  )
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
  {#if hasPorts}
    <path
      class="wm-overlay"
      class:wm-static={animation === 'reduced'}
      data-direction="in"
      d={inPathD}
      style:--wm-color={inColor}
      style:--wm-width={String(laneWidth)}
      style:--wm-play={inDuration <= 0 ? 'paused' : 'running'}
      style:--wm-duration={inDuration <= 0 ? '0ms' : `${inDuration}ms`}
    />
    <path
      class="wm-overlay"
      class:wm-static={animation === 'reduced'}
      data-direction="out"
      d={outPathD}
      style:--wm-color={outColor}
      style:--wm-width={String(laneWidth)}
      style:--wm-play={outDuration <= 0 ? 'paused' : 'running'}
      style:--wm-duration={outDuration <= 0 ? '0ms' : `${outDuration}ms`}
    />
  {:else}
    <!-- Port-less edge: render one combined lane (no direction split). -->
    <path
      class="wm-overlay"
      class:wm-static={animation === 'reduced'}
      data-direction="in"
      d={context.pathD}
      style:--wm-color={baseColor}
      style:--wm-width={String(laneWidth)}
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
