<script lang="ts">
  /**
   * WeathermapOverlay — drives CSS-animation-based traffic-flow
   * visualization over the rendered topology SVG. Composes on top of
   * TopologyViewer via the shared svgElement handle.
   *
   * Lifecycle: attaches a WeathermapController to the svg on mount,
   * calls apply() whenever metrics change, and destroys on unmount or
   * when the svg changes (e.g. sheet switch).
   */
  import { type LinkFlowMetrics, WeathermapController } from '$lib/weathermap'

  export type WeathermapAnimation = 'full' | 'reduced' | 'off'

  interface Props {
    svgElement: SVGSVGElement | null
    metrics: Record<string, LinkFlowMetrics> | undefined
    enabled?: boolean
    /**
     * 'full'    — color + flow dots (default)
     * 'reduced' — color only, no animated dots (cheap, small widgets)
     * 'off'     — completely disabled (equivalent to enabled=false, but
     *             also skips controller creation)
     */
    animation?: WeathermapAnimation
  }

  let { svgElement, metrics, enabled = true, animation = 'full' }: Props = $props()

  let controller: WeathermapController | null = null

  $effect(() => {
    if (!svgElement || !enabled || animation === 'off') {
      controller?.destroy()
      controller = null
      return
    }
    if (!controller) {
      controller = new WeathermapController(svgElement)
    }
    controller.setAnimationMode(animation)
    controller.apply(metrics)
  })

  $effect(() => {
    return () => {
      controller?.destroy()
      controller = null
    }
  })
</script>
