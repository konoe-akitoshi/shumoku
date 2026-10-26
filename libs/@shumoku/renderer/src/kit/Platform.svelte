<script lang="ts">
  import type { Node } from '@shumoku/core'
  import type { RenderColors } from '../lib/render-colors'
  import { type Kit, platformListTop, platformRows } from './measure'
  import type { Box } from './scene'

  let {
    platform,
    colors,
    kit,
  }: {
    platform: {
      id: string
      label: string
      kind?: string
      box: Box
      hosts: { node: Node; box: Box }[]
      workloads: Node[]
      shown: number
      compact: boolean
      chipRow: boolean
    }
    colors: RenderColors
    kit: Kit
  } = $props()

  const tokens = $derived(kit.tokens)
  const p = $derived(tokens.platform)
  const box = $derived(platform.box)
  const list = $derived(
    platformRows(platform.workloads, { shown: platform.shown, compact: platform.compact }),
  )
  const listTop = $derived(box.y + platformListTop(platform.chipRow, tokens))
  /** The middle of a row's text, below the list's top. */
  const rowMiddle = (i: number) => listTop + i * p.rowHeight + p.rowHeight / 2
</script>

<g class="platform" data-id={platform.id}>
  <title>{platform.label}</title>
  <rect
    x={box.x}
    y={box.y}
    width={box.width}
    height={box.height}
    rx={p.cornerRadius}
    ry={p.cornerRadius}
    fill={colors.nodeFill}
    stroke={colors.nodeStroke}
    stroke-width={tokens.line.base}
    filter="url(#node-shadow)"
  />
  <g pointer-events="none">
    <text
      class="platform-label"
      x={box.x + p.pad}
      y={box.y + p.pad + p.labelHeight / 2 + tokens.text.platformLabel.shift}
    >
      {platform.label}
    </text>
    {#if platform.kind}
      <text
        class="platform-kind"
        x={box.x + box.width - p.pad}
        y={box.y + p.pad + p.labelHeight / 2 + tokens.text.hullLabel.shift}
        text-anchor="end"
      >
        {platform.kind.toUpperCase()}
      </text>
    {/if}
    {#if platform.chipRow}
      {#each platform.hosts as { node, box: chip } (node.id)}
        <g data-id={node.id}>
          <rect
            x={chip.x}
            y={chip.y}
            width={chip.width}
            height={chip.height}
            rx={p.chipRadius}
            ry={p.chipRadius}
            fill={colors.subgraphFill}
            stroke={colors.nodeStroke}
            stroke-opacity={tokens.opacity.line}
            stroke-width={tokens.line.hair}
          />
          <text
            class="platform-chip"
            x={chip.x + chip.width / 2}
            y={chip.y + chip.height / 2 + tokens.text.chip.shift}
            text-anchor="middle"
          >
            {node.label}
          </text>
        </g>
      {/each}
    {/if}
    {#if list.rows.length > 0}
      <line
        x1={box.x + p.pad}
        x2={box.x + box.width - p.pad}
        y1={listTop - p.sectionGap / 2}
        y2={listTop - p.sectionGap / 2}
        stroke={colors.nodeStroke}
        stroke-opacity={tokens.opacity.line}
        stroke-width={tokens.line.thin}
      />
    {/if}
    {#each list.rows as row, i}
      <text
        class="workload-name"
        x={box.x + p.pad}
        y={rowMiddle(i) + tokens.text.workloadName.shift}
      >
        {row.name}
      </text>
      <text
        class="workload-detail"
        x={box.x + box.width - p.pad}
        y={rowMiddle(i) + tokens.text.workloadDetail.shift}
        text-anchor="end"
      >
        {row.detail}
      </text>
    {/each}
    {#if list.more > 0}
      <text
        class="workload-detail"
        x={box.x + p.pad}
        y={rowMiddle(list.rows.length) + tokens.text.workloadDetail.shift}
      >
        +{list.more}
        more
      </text>
    {/if}
  </g>
</g>
