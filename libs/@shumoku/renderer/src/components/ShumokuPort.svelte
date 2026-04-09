<script lang="ts">
  import type { ResolvedPort } from '@shumoku/core'

  let { port }: { port: ResolvedPort } = $props()

  const labelOffset = 12

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
</script>

<g class="port" data-port-id={port.id}>
  <rect
    x={port.absolutePosition.x - port.size.width / 2}
    y={port.absolutePosition.y - port.size.height / 2}
    width={port.size.width}
    height={port.size.height}
    rx="2"
    fill="#334155"
    stroke="#0f172a"
    stroke-width="1"
  />
  <text x={labelX()} y={labelY()} text-anchor={textAnchor()} font-size="9" fill="#64748b">
    {port.label}
  </text>
</g>
