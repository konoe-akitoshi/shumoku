<script lang="ts">
  import type { ResolvedNode } from '@shumoku/core'

  let {
    node,
    selected = false,
    highlighted = false,
  }: {
    node: ResolvedNode
    selected?: boolean
    highlighted?: boolean
  } = $props()

  const active = $derived(selected || highlighted)

  const cx = $derived(node.position.x)
  const cy = $derived(node.position.y)
  const hw = $derived(node.size.width / 2)
  const hh = $derived(node.size.height / 2)

  const label = $derived(
    Array.isArray(node.node.label) ? (node.node.label[0] ?? '') : (node.node.label ?? ''),
  )
</script>

<g class="node" data-node-id={node.id}>
  <rect
    x={cx - hw}
    y={cy - hh}
    width={node.size.width}
    height={node.size.height}
    rx="8"
    fill={active ? '#eff6ff' : '#f8fafc'}
    stroke={active ? '#3b82f6' : '#64748b'}
    stroke-width={active ? 2 : 1.5}
  />
  <text
    x={cx}
    y={cy}
    text-anchor="middle"
    dominant-baseline="central"
    font-size="14"
    fill="#1e293b"
    pointer-events="none"
  >
    {label}
  </text>
</g>
