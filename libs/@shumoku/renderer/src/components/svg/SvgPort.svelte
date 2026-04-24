<script lang="ts">
  import type { ResolvedPort } from '@shumoku/core'
  import { SMALL_LABEL_CHAR_WIDTH } from '@shumoku/core'
  import type { PortOverlaySnippet } from '../../lib/overlays'
  import type { RenderColors } from '../../lib/render-colors'
  import { computePortLabelPosition } from '../../lib/svg-coords'

  let {
    port,
    colors,
    hideLabel = false,
    selected = false,
    interactive = false,
    linked = false,
    overlay,
    onlinkstart,
    onlinkend,
    onselect,
    onlabeledit,
    oncontextmenu: onctx,
  }: {
    port: ResolvedPort
    colors: RenderColors
    hideLabel?: boolean
    selected?: boolean
    interactive?: boolean
    linked?: boolean
    overlay?: PortOverlaySnippet
    onlinkstart?: (portId: string, x: number, y: number) => void
    onlinkend?: (portId: string) => void
    onselect?: (portId: string) => void
    onlabeledit?: (portId: string, label: string, screenX: number, screenY: number) => void
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
  const overlayContext = $derived({
    selected,
    interactive,
    linked,
    px,
    py,
    width: pw,
    height: ph,
  })

  let hovered = $state(false)

  function onpointerdown(e: PointerEvent) {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    // Select always; link-start only in edit mode
    onselect?.(port.id)
    if (interactive && !linked) {
      onlinkstart?.(port.id, px, py)
    }
  }

  function onpointerup(e: PointerEvent) {
    if (!interactive) return
    e.stopPropagation()
    onlinkend?.(port.id)
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    onselect?.(port.id)
    onctx?.(port.id, e)
  }
</script>

<g
  class="port"
  data-port={port.id}
  data-port-device={port.nodeId}
  onpointerenter={() => { hovered = interactive }}
  onpointerleave={() => { hovered = false }}
  oncontextmenu={handleContextMenu}
>
  <!-- Hit area (CSS controls pointer-events via .interactive) -->
  <rect
    class="port-hit {linked ? 'linked' : ''}"
    x={px - 12}
    y={py - 12}
    width={24}
    height={24}
    fill="transparent"
    {onpointerdown}
    {onpointerup}
  />

  <!-- Port box -->
  <rect
    class="port-box"
    x={px - pw / 2 - (selected || hovered ? 2 : 0)}
    y={py - ph / 2 - (selected || hovered ? 2 : 0)}
    width={pw + (selected || hovered ? 4 : 0)}
    height={ph + (selected || hovered ? 4 : 0)}
    fill={selected ? colors.selection : hovered ? '#3b82f6' : colors.portFill}
    stroke={selected ? colors.selection : hovered ? '#2563eb' : colors.portStroke}
    stroke-width={selected || hovered ? 2 : 1}
    rx="2"
    pointer-events="none"
  />

  {@render overlay?.(port, overlayContext)}

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
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <text
      class="port-label-text"
      x={labelPos.x}
      y={labelPos.y}
      text-anchor={labelPos.textAnchor}
      font-size="9"
      fill={colors.portLabelColor}
      onclick={(e: MouseEvent) => {
        if (!interactive) return
        e.stopPropagation()
        onlabeledit?.(port.id, port.label, e.clientX, e.clientY)
      }}
    >
      {port.label}
    </text>
  {/if}
</g>
