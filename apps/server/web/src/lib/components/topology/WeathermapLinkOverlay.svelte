<script lang="ts">
  import type { LinkOverlayContext } from '@shumoku/renderer'
  import {
    bpsToDurationMs,
    createOffsetPathD,
    DOWN_COLOR,
    getUtilizationColor,
    type LinkFlowMetrics,
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
  const laneWidth = $derived(Math.max(context.width / 2, 2))
  const laneOffset = $derived(context.width / 4)
  const baseColor = $derived(down ? DOWN_COLOR : getUtilizationColor(Math.max(inUtil, outUtil)))
  const inColor = $derived(down ? DOWN_COLOR : getUtilizationColor(inUtil))
  const outColor = $derived(down ? DOWN_COLOR : getUtilizationColor(outUtil))
  const inDuration = $derived(bpsToDurationMs(metrics?.inBps ?? 0))
  const outDuration = $derived(bpsToDurationMs(metrics?.outBps ?? 0))
  const inPathD = $derived(
    context.pathElement ? createOffsetPathD(context.pathElement, laneOffset) : context.pathD,
  )
  const outPathD = $derived(
    context.pathElement ? createOffsetPathD(context.pathElement, -laneOffset) : context.pathD,
  )

  $effect(() => {
    // The renderer hands us the link-group element via context, so
    // we don't have to walk the DOM (`closest('g.link-group')`) and
    // re-leak the renderer's class names back into this overlay.
    const group = context.groupElement
    if (!group) return
    if (!active) {
      group.classList.remove('wm-active')
      group.style.removeProperty('--wm-base-color')
      return
    }
    group.classList.add('wm-active')
    group.style.setProperty('--wm-base-color', baseColor)
    return () => {
      group.classList.remove('wm-active')
      group.style.removeProperty('--wm-base-color')
    }
  })
</script>

{#if active}
  <path
    class="wm-overlay"
    class:wm-static={animation === 'reduced'}
    data-direction="in"
    d={inPathD}
    style:--wm-color={inColor}
    style:--wm-width={String(laneWidth)}
    style:--wm-dash={down ? '8 4' : '3 21'}
    style:--wm-opacity={down ? '0.5' : '0.9'}
    style:--wm-play={down || inDuration <= 0 ? 'paused' : 'running'}
    style:--wm-duration={down || inDuration <= 0 ? '0ms' : `${inDuration}ms`}
  />
  <path
    class="wm-overlay"
    class:wm-static={animation === 'reduced'}
    data-direction="out"
    d={outPathD}
    style:--wm-color={outColor}
    style:--wm-width={String(laneWidth)}
    style:--wm-dash={down ? '8 4' : '3 21'}
    style:--wm-opacity={down ? '0.5' : '0.9'}
    style:--wm-play={down || outDuration <= 0 ? 'paused' : 'running'}
    style:--wm-duration={down || outDuration <= 0 ? '0ms' : `${outDuration}ms`}
  />
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
      animation: none !important;
    }
  }
</style>
