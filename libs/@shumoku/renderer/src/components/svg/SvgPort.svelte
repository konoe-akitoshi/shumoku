<script lang="ts">
  import { createEngine, type ResolvedPort } from '@shumoku/core'

  /** Shared sizing engine for label-width measurement. */
  const engine = createEngine()

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
    onportdragmove,
    onportdragend,
    preventContextMenuDefault = true,
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
    /** Click on this port. Receives the original event so the renderer can
     *  read modifier keys for additive multi-selection. */
    onselect?: (portId: string, e?: MouseEvent) => void
    onlabeledit?: (portId: string, label: string, screenX: number, screenY: number) => void
    oncontextmenu?: (portId: string, e: MouseEvent) => void
    /** Drag a linked port to a different placement on the same node.
     *  Fires after a small movement threshold so a plain click still
     *  selects without entering drag mode. Coordinates are screen pixels
     *  (clientX/clientY); host translates and computes the target side. */
    onportdragmove?: (portId: string, screenX: number, screenY: number) => void
    onportdragend?: (portId: string, screenX: number, screenY: number) => void
    preventContextMenuDefault?: boolean
  } = $props()

  const px = $derived(port.absolutePosition.x)
  const py = $derived(port.absolutePosition.y)
  const pw = $derived(port.size.width)
  const ph = $derived(port.size.height)
  const labelPos = $derived(computePortLabelPosition(port))

  const hasLabel = $derived(port.label.trim().length > 0)
  const verticalLabel = $derived(
    port.labelOrientation === 'vertical' && (port.side === 'top' || port.side === 'bottom'),
  )
  const labelWidth = $derived(engine.text.measure(port.label, 'port') + 4)
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

  // Port-move drag state. A linked port enters drag mode if the user
  // moves more than DRAG_THRESHOLD px after pressing it; otherwise the
  // pointerdown was just a click for selection. Unlinked ports keep
  // the link-draw behaviour (pointerdown immediately starts a link).
  const DRAG_THRESHOLD = 5
  let dragPointerId: number | null = null
  let dragStartX = 0
  let dragStartY = 0
  let dragging = $state(false)

  function onpointerdown(e: PointerEvent) {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    onselect?.(port.id, e)
    if (!interactive) return

    if (linked && onportdragend) {
      dragPointerId = e.pointerId
      dragStartX = e.clientX
      dragStartY = e.clientY
      const el = e.currentTarget as Element
      el.setPointerCapture?.(e.pointerId)
    } else {
      onlinkstart?.(port.id, px, py)
    }
  }

  function onpointermove(e: PointerEvent) {
    if (dragPointerId === null || e.pointerId !== dragPointerId) return
    if (!dragging) {
      const dx = e.clientX - dragStartX
      const dy = e.clientY - dragStartY
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      dragging = true
    }
    onportdragmove?.(port.id, e.clientX, e.clientY)
  }

  function onpointerup(e: PointerEvent) {
    if (dragPointerId !== null && e.pointerId === dragPointerId) {
      const el = e.currentTarget as Element
      el.releasePointerCapture?.(e.pointerId)
      const wasDragging = dragging
      dragPointerId = null
      dragging = false
      if (wasDragging) {
        e.stopPropagation()
        onportdragend?.(port.id, e.clientX, e.clientY)
        return
      }
    }
    if (!interactive) return
    e.stopPropagation()
    onlinkend?.(port.id)
  }

  function handleContextMenu(e: MouseEvent) {
    if (preventContextMenuDefault) e.preventDefault()
    onselect?.(port.id, e)
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
    class="port-hit {linked ? 'linked' : ''} {dragging ? 'dragging' : ''}"
    x={px - 12}
    y={py - 12}
    width={24}
    height={24}
    fill="transparent"
    {onpointerdown}
    {onpointermove}
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

  {#if !hideLabel && hasLabel}
    {#if verticalLabel}
      <!-- Dense face (layout hint): run the label along the wire so
           neighbors can't overlap — drawn like a right-side label,
           rotated 90° around the port (up for top, down for bottom). -->
      <g transform={`rotate(${port.side === 'top' ? -90 : 90} ${px} ${py})`} pointer-events="none">
        <rect
          class="port-label-bg"
          x={px + 10}
          y={py - labelHeight + 3}
          width={labelWidth}
          height={labelHeight}
          rx="2"
          fill={colors.portLabelBg}
        />
        <text
          class="port-label-text"
          x={px + 12}
          y={py}
          text-anchor="start"
          font-size="9"
          fill={colors.portLabelColor}
        >
          {port.label}
        </text>
      </g>
    {:else}
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
  {/if}
</g>
