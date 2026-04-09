<script lang="ts">
  import type { ResolvedPort } from '@shumoku/core'

  let {
    port,
    onlinkstart,
    onlinkend,
    onlabeledit,
  }: {
    port: ResolvedPort
    onlinkstart?: (portId: string, x: number, y: number) => void
    onlinkend?: (portId: string) => void
    onlabeledit?: (portId: string, rect: DOMRect) => void
  } = $props()

  const labelOffset = 12
  let hovered = $state(false)
  let labelEl = $state<SVGTextElement | null>(null)

  const labelX = $derived(() => {
    switch (port.side) {
      case 'left':
        return port.absolutePosition.x - labelOffset
      case 'right':
        return port.absolutePosition.x + labelOffset
      default:
        return port.absolutePosition.x
    }
  })

  const labelY = $derived(() => {
    switch (port.side) {
      case 'top':
        return port.absolutePosition.y - labelOffset
      case 'bottom':
        return port.absolutePosition.y + labelOffset + 4
      default:
        return port.absolutePosition.y
    }
  })

  const textAnchor = $derived(() => {
    switch (port.side) {
      case 'left':
        return 'end'
      case 'right':
        return 'start'
      default:
        return 'middle'
    }
  })

  function onPortDown(e: PointerEvent) {
    e.stopPropagation()
    onlinkstart?.(port.id, port.absolutePosition.x, port.absolutePosition.y)
  }

  function onPortUp(e: PointerEvent) {
    e.stopPropagation()
    onlinkend?.(port.id)
  }

  function onLabelClick(e: MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    if (!labelEl) return
    const rect = labelEl.getBoundingClientRect()
    onlabeledit?.(port.id, rect)
  }
</script>

<g class="port" data-port-id={port.id}>
  <!-- Port square: for linking -->
  <g
    role="button"
    tabindex="-1"
    onpointerdown={onPortDown}
    onpointerup={onPortUp}
    onpointerenter={() => (hovered = true)}
    onpointerleave={() => (hovered = false)}
    style="cursor: crosshair"
  >
    <rect
      x={port.absolutePosition.x - 12}
      y={port.absolutePosition.y - 12}
      width={24}
      height={24}
      fill="transparent"
    />
    <rect
      x={port.absolutePosition.x - port.size.width / 2}
      y={port.absolutePosition.y - port.size.height / 2}
      width={hovered ? port.size.width + 4 : port.size.width}
      height={hovered ? port.size.height + 4 : port.size.height}
      rx="2"
      fill={hovered ? '#3b82f6' : '#334155'}
      stroke={hovered ? '#2563eb' : '#0f172a'}
      stroke-width={hovered ? 2 : 1}
      transform={hovered ? `translate(${-2}, ${-2})` : ''}
    />
  </g>

  <!-- Label: click to edit (emits position to parent) -->
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <text
    bind:this={labelEl}
    x={labelX()}
    y={labelY()}
    text-anchor={textAnchor()}
    font-size="9"
    fill="#64748b"
    style="cursor: text"
    onclick={onLabelClick}
  >
    {port.label}
  </text>
</g>
