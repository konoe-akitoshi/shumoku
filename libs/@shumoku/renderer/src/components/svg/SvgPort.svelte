<script lang="ts">
  import type { ResolvedPort } from '@shumoku/core'
  import { SMALL_LABEL_CHAR_WIDTH } from '@shumoku/core'
  import type { RenderColors } from '../../lib/render-colors'
  import { computePortLabelPosition } from '../../lib/svg-coords'

  let {
    port,
    colors,
    hideLabel = false,
    selected = false,
    interactive = false,
    linked = false,
    onlinkstart,
    onlinkend,
    onselect,
    oncontextmenu: onctx,
  }: {
    port: ResolvedPort
    colors: RenderColors
    hideLabel?: boolean
    selected?: boolean
    interactive?: boolean
    linked?: boolean
    onlinkstart?: (portId: string, x: number, y: number) => void
    onlinkend?: (portId: string) => void
    onselect?: (portId: string) => void
    oncontextmenu?: (portId: string, e: MouseEvent) => void
  } = $props()

  const px = $derived(port.absolutePosition.x)
  const py = $derived(port.absolutePosition.y)
  const pw = $derived(port.size.width)
  const ph = $derived(port.size.height)
  const labelPos = $derived(computePortLabelPosition(port))

  const labelWidth = $derived(port.label.length * SMALL_LABEL_CHAR_WIDTH + 4)
  const labelHeight = 12
  const bgX = $derived(() => {
    if (labelPos.textAnchor === 'middle') return labelPos.x - labelWidth / 2
    if (labelPos.textAnchor === 'end') return labelPos.x - labelWidth + 2
    return labelPos.x - 2
  })
  const bgY = $derived(labelPos.y - labelHeight + 3)

  let hovered = $state(false)

  function onpointerdown(e: PointerEvent) {
    if (!interactive || e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    if (linked) {
      onselect?.(port.id)
    } else {
      onlinkstart?.(port.id, px, py)
    }
  }

  function onpointerup(e: PointerEvent) {
    if (!interactive) return
    e.stopPropagation()
    onlinkend?.(port.id)
  }

  function handleContextMenu(e: MouseEvent) {
    if (!interactive) return
    e.preventDefault()
    e.stopPropagation()
    onctx?.(port.id, e)
  }
</script>

<g
  class="port"
  data-port={port.id}
  data-port-device={port.nodeId}
  onpointerenter={() => { hovered = true }}
  onpointerleave={() => { hovered = false }}
  oncontextmenu={handleContextMenu}
>
  <!-- Hit area -->
  {#if interactive}
    <rect
      x={px - 12}
      y={py - 12}
      width={24}
      height={24}
      fill="transparent"
      style="pointer-events: fill; cursor: {linked ? 'pointer' : 'crosshair'};"
      {onpointerdown}
      {onpointerup}
    />
  {/if}

  <!-- Port box -->
  <rect
    class="port-box"
    x={px - pw / 2 - (selected || (interactive && hovered) ? 2 : 0)}
    y={py - ph / 2 - (selected || (interactive && hovered) ? 2 : 0)}
    width={pw + (selected || (interactive && hovered) ? 4 : 0)}
    height={ph + (selected || (interactive && hovered) ? 4 : 0)}
    fill={selected ? colors.selection : (interactive && hovered) ? '#3b82f6' : colors.portFill}
    stroke={selected ? colors.selection : (interactive && hovered) ? '#2563eb' : colors.portStroke}
    stroke-width={selected || (interactive && hovered) ? 2 : 1}
    rx="2"
    pointer-events="none"
  />

  {#if !hideLabel}
    <rect
      class="port-label-bg"
      x={bgX()}
      y={bgY}
      width={labelWidth}
      height={labelHeight}
      rx="2"
      fill={colors.portLabelBg}
      pointer-events="none"
    />
    <text
      class="port-label"
      x={labelPos.x}
      y={labelPos.y}
      text-anchor={labelPos.textAnchor}
      font-size="9"
      fill={colors.portLabelColor}
      pointer-events="none"
    >
      {port.label}
    </text>
  {/if}
</g>
