<script lang="ts">
  import type { LinkOverlayContext } from '@shumoku/renderer'
  import { bezierOffsetPath, polylineOffsetPath } from '@shumoku/renderer'
  import {
    bpsToDurationMs,
    computeLaneGeometry,
    DOWN_COLOR,
    flowLevel,
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

  // Three variables, three channels (see weathermap conventions: color =
  // utilization, particle frequency/speed = throughput intensity, motion =
  // direction):
  //   - COLOR encodes UTILISATION (congestion): green → amber → red.
  //   - MOTION direction encodes FLOW direction (in vs out flow opposite ways;
  //     lane position reinforces it).
  //   - PARTICLE DENSITY + SPEED + brightness encode THROUGHPUT (bps): busier
  //     links stream denser, faster and brighter.
  const inColor = $derived(down ? DOWN_COLOR : getUtilizationColor(inUtil))
  const outColor = $derived(down ? DOWN_COLOR : getUtilizationColor(outUtil))
  const baseColor = $derived(down ? DOWN_COLOR : getUtilizationColor(Math.max(inUtil, outUtil)))
  // Throughput intensity 0..1 (log-scaled bps, utilization fallback) — drives
  // density + brightness. Speed comes from the existing duration mapping.
  const inLevel = $derived(flowLevel(metrics?.inBps ?? 0, inUtil))
  const outLevel = $derived(flowLevel(metrics?.outBps ?? 0, outUtil))
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

  // Lane geometry is computed analytically from port positions/sides, so we
  // don't need a mounted SVGPathElement. When port data is missing (degenerate
  // / non-port edges) we collapse to a single centered lane — see template.
  const hasPorts = $derived(!!(context.fromPort && context.toPort))
  const canSplit = $derived(hasPorts && geom.canSplit)
  function lanePath(signedOffset: number): string {
    if (context.routePoints && context.routePoints.length >= 2) {
      return polylineOffsetPath(context.routePoints, signedOffset)
    }
    if (hasPorts && context.fromPort && context.toPort) {
      return bezierOffsetPath(context.fromPort, context.toPort, signedOffset)
    }
    return context.pathD
  }

  // Particle stream geometry. Dot size is a small fraction of the lane; the GAP
  // shrinks as throughput rises (denser stream), so `period` (= dot + gap) is
  // the seamless-loop travel distance the keyframe uses (bare CSS var — a
  // negated calc() var does NOT interpolate in Chrome; the reverse lane flips
  // direction via animation-direction instead).
  function stream(laneWidth: number, level: number) {
    // Streaks are elongated ALONG the path (longer than the lane is wide) so
    // they read as flowing light, not squished blobs. Gap shrinks with
    // throughput (denser stream when busy).
    const streak = Math.max(laneWidth * 1.6, 3)
    const gap = laneWidth * (4 - 2.4 * level)
    return { dot: streak, gap, period: streak + gap }
  }

  const lanes = $derived([
    {
      dir: 'in' as const,
      d: lanePath(geom.laneOffset),
      color: inColor,
      duration: inDuration,
      level: inLevel,
      stream: stream(geom.laneWidth, inLevel),
    },
    {
      dir: 'out' as const,
      d: lanePath(-geom.laneOffset),
      color: outColor,
      duration: outDuration,
      level: outLevel,
      stream: stream(geom.laneWidth, outLevel),
    },
  ])
  const combinedDuration = $derived(
    inDuration > 0 && outDuration > 0
      ? Math.min(inDuration, outDuration)
      : Math.max(inDuration, outDuration),
  )
  const combinedLevel = $derived(Math.max(inLevel, outLevel))
  const combinedStream = $derived(stream(geom.combinedWidth, combinedLevel))
  const flowing = $derived(animation === 'full')

  $effect(() => {
    // Tint the base link (the continuous "pipe" under the stream) via the
    // renderer's group — no DOM walking, no re-leaking renderer class names.
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
        class="wm-flow"
        data-direction={lane.dir}
        d={lane.d}
        style:--wm-color={lane.color}
        style:--wm-width={String(geom.laneWidth)}
        style:--wm-dot={String(lane.stream.dot)}
        style:--wm-gap={String(lane.stream.gap)}
        style:--wm-period={String(lane.stream.period)}
        style:opacity={0.5 + 0.4 * lane.level}
        style:--wm-play={flowing && lane.duration > 0 ? 'running' : 'paused'}
        style:--wm-duration={lane.duration <= 0 ? '0ms' : `${lane.duration}ms`}
      />
    {/each}
  {:else}
    <!-- Port-less or too-thin edge: one centered stream fills the line. -->
    <path
      class="wm-flow"
      data-direction="out"
      d={context.pathD}
      style:--wm-color={baseColor}
      style:--wm-width={String(geom.combinedWidth)}
      style:--wm-dot={String(combinedStream.dot)}
      style:--wm-gap={String(combinedStream.gap)}
      style:--wm-period={String(combinedStream.period)}
      style:opacity={0.5 + 0.4 * combinedLevel}
      style:--wm-play={flowing && combinedDuration > 0 ? 'running' : 'paused'}
      style:--wm-duration={combinedDuration <= 0 ? '0ms' : `${combinedDuration}ms`}
    />
  {/if}
{/if}

<style>
  /* A lane's flow is a stream of small round dots. Round caps make each dot a
         soft pill and keep the ends inside the line (caps extend along the path,
         not across its width, so the partition / no-overflow guarantee holds). */
  .wm-flow {
    pointer-events: none;
    fill: none;
    stroke: var(--wm-color, currentColor);
    stroke-width: var(--wm-width, 2);
    stroke-linecap: round;
    stroke-dasharray: var(--wm-dot, 3) var(--wm-gap, 18);
    animation-name: wm-flow;
    animation-duration: var(--wm-duration, 2s);
    animation-timing-function: linear;
    animation-iteration-count: infinite;
    animation-play-state: var(--wm-play, paused);
  }

  /* The `in` lane streams the opposite way — via direction, not a negated
         calc() keyframe (which Chrome refuses to interpolate). */
  .wm-flow[data-direction="in"] {
    animation-direction: reverse;
  }

  /* Travel exactly one dot period per iteration for a seamless loop. Bare var
         resolves to a number Chrome can tween. */
  @keyframes wm-flow {
    from {
      stroke-dashoffset: 0;
    }
    to {
      stroke-dashoffset: var(--wm-period, 21);
    }
  }

  /* Camera gesture LOD: hide the animated stream during a wheel/drag so pan/
         zoom keeps its frame budget — the base link keeps its utilization tint via
         `.wm-active > path.link`, so the diagram still reads mid-gesture. */
  :global(svg.camera-gesture) .wm-flow {
    display: none;
  }

  :global(.wm-active > path.link) {
    stroke: var(--wm-base-color, currentColor);
    opacity: 0.55;
    transition:
      stroke 200ms ease,
      opacity 200ms ease;
  }

  /* Down: no stream; the base link itself is the indicator — solid red dashed
         line, full opacity. */
  :global(.wm-active.wm-down > path.link) {
    opacity: 1;
    stroke-dasharray: 8 4;
  }

  @media (prefers-reduced-motion: reduce) {
    .wm-flow {
      animation: none !important;
      stroke-dasharray: none;
      opacity: 0.6;
    }
  }
</style>
