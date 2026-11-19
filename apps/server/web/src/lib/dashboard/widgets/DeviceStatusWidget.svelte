<script lang="ts">
  /**
   * A topology's devices by type, as a donut of up / down / unknown (Lighthouse-style score).
   * Status comes from the topology's live feed. Hovering a type or a segment brings those nodes
   * forward on the dashboard's views of the same topology.
   */
  import { type Node as NetworkNode, specDeviceType } from '@shumoku/core'
  import { CpuIcon, SpinnerIcon } from 'phosphor-svelte'
  import { preferences, watchTopologyLive } from '$lib/stores'
  import { statusColor } from '$lib/weathermap'
  import { useDashboard } from '../dashboard.svelte'
  import { configBoolean, configString, type WidgetProps } from '../widget-types'
  import WidgetEmpty from './WidgetEmpty.svelte'

  let { id, config, openSettings }: WidgetProps = $props()
  const dashboard = useDashboard()
  const reader = dashboard.reader

  const topologyId = $derived(configString(config, 'topologyId'))
  const showDetail = $derived(configBoolean(config, 'showDetail'))

  // --- State ---
  let nodes: NetworkNode[] = $state([])
  let loading = $state(true)
  let error = $state('')
  let isHovered = $state(false)
  let hoveredType = $state<string | null>(null)
  let hoveredSegment = $state<{ type: string; status: string } | null>(null)

  // --- Constants ---
  // The theme's status colours, as CSS variables (lib/weathermap/colors.ts).
  const STATUS_COLORS = {
    up: statusColor('up'),
    down: statusColor('down'),
    unknown: statusColor('unknown'),
  }
  const CX = 18,
    CY = 18,
    R = 15.5,
    SW = 3
  const CIRC = 2 * Math.PI * R
  const GAP = 0.08 * R // gap between segments (arc length)
  const TYPE_GAP = 0.14 * R // larger gap between device types

  // --- Types ---
  interface TypeStatus {
    type: string
    displayName: string
    total: number
    up: number
    down: number
    unknown: number
    score: number
  }

  interface Segment {
    color: string
    dashArray: string
    dashOffset: number
    opacity: number
    type?: string
    status?: string
  }

  interface TypeLabel {
    type: string
    displayName: string
    x: number
    y: number
    anchor: string
  }

  // --- Helpers ---
  function formatTypeName(type: string): string {
    return type
      .split('-')
      .map((w) => (w[0] ?? '').toUpperCase() + w.slice(1))
      .join(' ')
  }

  function scoreColorClass(score: number): string {
    if (score >= 90) return 'text-success'
    if (score >= 50) return 'text-warning'
    return 'text-danger'
  }

  /** Build stroke-dasharray segments from a list of {count, color, gap} items */
  function buildSegments(
    items: { count: number; color: string; gap: number; type?: string; status?: string }[],
    total: number,
    opacityFn?: (item: { type?: string; status?: string }) => number,
  ): Segment[] {
    const n = items.length
    if (n === 0 || total === 0) return []

    const totalGap = n > 1 ? items.reduce((s, i) => s + i.gap, 0) : 0
    const available = CIRC - totalGap
    const segments: Segment[] = []
    let offset = 0

    for (const item of items) {
      const len = (item.count / total) * available
      segments.push({
        color: item.color,
        dashArray: `${len} ${CIRC - len}`,
        dashOffset: -offset,
        opacity: opacityFn?.(item) ?? 1,
        type: item.type,
        status: item.status,
      })
      offset += len + (n > 1 ? item.gap : 0)
    }
    return segments
  }

  /** Compute SVG label positions around the donut */
  function buildTypeLabelPositions(
    items: { count: number; gap: number; type: string }[],
    total: number,
  ): TypeLabel[] {
    const n = items.length
    if (n === 0 || total === 0) return []

    const totalGap = n > 1 ? items.reduce((s, i) => s + i.gap, 0) : 0
    const available = CIRC - totalGap
    const labels: TypeLabel[] = []
    let offset = 0
    let curType = ''
    let typeStart = 0
    const labelR = R + SW / 2 + 4

    function pushLabel(type: string, endOffset: number) {
      const ts = typeStatuses.find((t) => t.type === type)
      if (!ts) return
      const mid = (typeStart + endOffset) / 2
      const angleRad = (mid / CIRC) * 2 * Math.PI - Math.PI / 2
      const cos = Math.cos(angleRad)
      labels.push({
        type,
        displayName: ts.displayName,
        x: CX + labelR * cos,
        y: CY + labelR * Math.sin(angleRad),
        anchor: cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle',
      })
    }

    for (const item of items) {
      if (item.type !== curType) {
        if (curType) pushLabel(curType, offset)
        curType = item.type
        typeStart = offset
      }
      offset += (item.count / total) * available + (n > 1 ? item.gap : 0)
    }
    if (curType) pushLabel(curType, offset)
    return labels
  }

  /** Expand typeStatuses into flat per-status items with gap info */
  function buildDetailItems() {
    const items: { count: number; color: string; type: string; status: string; gap: number }[] = []
    for (const [ti, ts] of typeStatuses.entries()) {
      const entries = (['up', 'down', 'unknown'] as const)
        .filter((s) => ts[s] > 0)
        .map((s) => ({ status: s, count: ts[s], color: STATUS_COLORS[s] }))
      for (const [i, entry] of entries.entries()) {
        const isTypeBoundary = i === entries.length - 1 && ti < typeStatuses.length - 1
        items.push({ ...entry, type: ts.type, gap: isTypeBoundary ? TYPE_GAP : GAP })
      }
    }
    return items
  }

  // --- Derived data ---
  let typeStatuses = $derived.by(() => {
    if (nodes.length === 0) return [] as TypeStatus[]
    const groups = new Map<
      string,
      { nodes: NetworkNode[]; up: number; down: number; unknown: number }
    >()
    for (const node of nodes) {
      const type = specDeviceType(node.spec) || 'unknown'
      const g = groups.get(type) ?? { nodes: [], up: 0, down: 0, unknown: 0 }
      g.nodes.push(node)
      groups.set(type, g)
      const s = nodeMetrics?.[node.id]?.status || 'unknown'
      if (s === 'up') g.up++
      else if (s === 'down') g.down++
      else g.unknown++
    }
    return [...groups.entries()]
      .map(([type, g]) => ({
        type,
        displayName: formatTypeName(type),
        total: g.nodes.length,
        up: g.up,
        down: g.down,
        unknown: g.unknown,
        score: g.nodes.length > 0 ? Math.round((g.up / g.nodes.length) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
  })

  let overallStats = $derived.by(() => {
    let total = 0,
      up = 0,
      down = 0,
      unknown = 0
    for (const s of typeStatuses) {
      total += s.total
      up += s.up
      down += s.down
      unknown += s.unknown
    }
    return { total, up, down, unknown, score: total > 0 ? Math.round((up / total) * 100) : 0 }
  })

  let overviewSegments = $derived.by(() => {
    const { total, up, down, unknown } = overallStats
    const items = [
      { count: up, color: STATUS_COLORS['up'], gap: GAP },
      { count: down, color: STATUS_COLORS['down'], gap: GAP },
      { count: unknown, color: STATUS_COLORS['unknown'], gap: GAP },
    ].filter((s) => s.count > 0)
    return buildSegments(items, total)
  })

  let detailSegments = $derived.by(() => {
    const items = buildDetailItems()
    const active = hoveredSegment?.type ?? hoveredType
    return buildSegments(items, overallStats.total, (item) => {
      if (!active) return 1
      if (item.type !== active) return 0.2
      if (hoveredSegment?.status !== item.status) return 0.5
      return 1
    })
  })

  let expanded = $derived(isHovered || showDetail)
  let currentSegments = $derived(expanded ? detailSegments : overviewSegments)

  let typeLabels = $derived.by(() => {
    const items = buildDetailItems().map(({ count, gap, type }) => ({ count, gap, type }))
    return buildTypeLabelPositions(items, overallStats.total)
  })

  // Dynamically compute viewBox to fit donut + labels
  let viewBox = $derived.by(() => {
    if (!expanded || typeLabels.length === 0) return '0 0 36 36'

    // Estimate text width: ~1.8 SVG units per character at font-size 3
    const charWidth = 1.8
    let minX = CX - R - SW,
      maxX = CX + R + SW
    let minY = CY - R - SW,
      maxY = CY + R + SW

    for (const label of typeLabels) {
      const textW = label.displayName.length * charWidth
      let lx0: number, lx1: number
      if (label.anchor === 'start') {
        lx0 = label.x
        lx1 = label.x + textW
      } else if (label.anchor === 'end') {
        lx0 = label.x - textW
        lx1 = label.x
      } else {
        lx0 = label.x - textW / 2
        lx1 = label.x + textW / 2
      }
      const ly0 = label.y - 2,
        ly1 = label.y + 2

      minX = Math.min(minX, lx0)
      maxX = Math.max(maxX, lx1)
      minY = Math.min(minY, ly0)
      maxY = Math.max(maxY, ly1)
    }

    const pad = 2
    return `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`
  })

  let centerLine1 = $derived.by(() => {
    if (hoveredSegment?.type) {
      const type = hoveredSegment.type
      const ts = typeStatuses.find((t) => t.type === type)
      if (!ts) return ''
      return String(ts[hoveredSegment.status as 'up' | 'down' | 'unknown'])
    }
    if (hoveredType) return String(typeStatuses.find((t) => t.type === hoveredType)?.score ?? 0)
    return String(overallStats.score)
  })

  let centerLine2 = $derived.by(() => {
    if (hoveredSegment) return hoveredSegment.status
    if (hoveredType) {
      const ts = typeStatuses.find((t) => t.type === hoveredType)
      return `${ts?.up ?? 0}/${ts?.total ?? 0}`
    }
    return `${overallStats.up}/${overallStats.total}`
  })

  let centerUnit = $derived(hoveredSegment ? '' : '%')

  let centerColor = $derived.by(() => {
    if (hoveredSegment) return ''
    if (hoveredType)
      return scoreColorClass(typeStatuses.find((t) => t.type === hoveredType)?.score ?? 0)
    return scoreColorClass(overallStats.score)
  })

  // --- Hover handlers ---
  function focusNodes(ids: string[]) {
    if (!topologyId || ids.length === 0) return
    dashboard.setFocus({ source: id, topologyId, nodeIds: ids, dim: true })
  }

  function handleSegmentHover(type: string, status: string) {
    hoveredSegment = { type, status }
    hoveredType = null
    focusNodes(
      nodes
        .filter(
          (n) =>
            (specDeviceType(n.spec) || 'unknown') === type &&
            (nodeMetrics?.[n.id]?.status || 'unknown') === status,
        )
        .map((n) => n.id),
    )
  }

  function handleTypeHover(type: string) {
    hoveredSegment = null
    hoveredType = type
    focusNodes(nodes.filter((n) => (specDeviceType(n.spec) || 'unknown') === type).map((n) => n.id))
  }

  function handleHoverLeave() {
    hoveredSegment = null
    hoveredType = null
    dashboard.clearFocus(id)
  }
  $effect(() => () => dashboard.clearFocus(id))

  // --- Data ---
  // The nodes, again whenever the topology is drawn again; their status from the live feed.
  async function loadNodes(topology: string, { quiet = false } = {}) {
    if (!quiet) loading = true
    error = ''
    try {
      const ctx = await reader.context(topology)
      if (topology !== topologyId) return
      nodes = ctx.nodes || []
    } catch (err) {
      if (!quiet) error = err instanceof Error ? err.message : 'Failed to load topology'
    } finally {
      loading = false
    }
  }

  const live = watchTopologyLive(
    () => (preferences.liveUpdates && topologyId ? reader.liveSource(topologyId) : null),
    () => {
      if (topologyId) void loadNodes(topologyId, { quiet: true })
    },
  )
  const nodeMetrics = $derived(live.metrics?.nodes)

  $effect(() => {
    const topology = topologyId
    nodes = []
    if (topology) void loadNodes(topology)
    else loading = false
  })
</script>

<div class="h-full w-full relative overflow-hidden">
  {#if !topologyId}
    <WidgetEmpty icon={CpuIcon} message="No topology selected" {openSettings} />
  {:else if loading}
    <div class="h-full flex items-center justify-center">
      <SpinnerIcon size={24} class="animate-spin text-theme-text-muted" />
    </div>
  {:else if error}
    <div class="h-full flex flex-col items-center justify-center text-danger gap-2">
      <span class="text-sm">{error}</span>
      <button
        type="button"
        onclick={() => topologyId && loadNodes(topologyId)}
        class="text-xs text-primary hover:underline"
      >
        Retry
      </button>
    </div>
  {:else if typeStatuses.length === 0}
    <div class="h-full flex flex-col items-center justify-center text-theme-text-muted gap-2">
      <CpuIcon size={32} />
      <span class="text-sm">No devices found</span>
    </div>
  {:else}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="h-full w-full flex items-center justify-center"
      onmouseenter={() => isHovered = true}
      onmouseleave={() => { isHovered = false; handleHoverLeave() }}
    >
      <svg
        class="w-full h-full transition-[viewBox] duration-300"
        {viewBox}
        preserveAspectRatio="xMidYMid meet"
      >
        <g transform="rotate(-90 {CX} {CY})">
          <circle
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke="currentColor"
            stroke-width={SW}
            class="text-theme-border opacity-20"
          />
          {#each currentSegments as seg}
            {#if expanded && seg.type}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <circle
                cx={CX}
                cy={CY}
                r={R}
                fill="none"
                style:stroke={seg.color}
                stroke-width={SW}
                stroke-dasharray={seg.dashArray}
                stroke-dashoffset={seg.dashOffset}
                opacity={seg.opacity}
                class="transition-opacity duration-200 cursor-pointer"
                onmouseenter={() => seg.type && seg.status && handleSegmentHover(seg.type, seg.status)}
                onmouseleave={() => { hoveredSegment = null; if (hoveredType) handleTypeHover(hoveredType) }}
              />
            {:else}
              <circle
                cx={CX}
                cy={CY}
                r={R}
                fill="none"
                style:stroke={seg.color}
                stroke-width={SW}
                stroke-dasharray={seg.dashArray}
                stroke-dashoffset={seg.dashOffset}
                opacity={seg.opacity}
                class="transition-opacity duration-200"
              />
            {/if}
          {/each}
        </g>

        <!-- Center text -->
        <text
          x={CX}
          y={CY - 2}
          text-anchor="middle"
          dominant-baseline="middle"
          class="fill-current {centerColor || 'text-theme-text-emphasis'}"
          font-size="9"
          font-weight="700"
        >
          {centerLine1}
        </text>
        {#if centerUnit}
          <text
            x={CX}
            y={CY - 2}
            text-anchor="start"
            dominant-baseline="middle"
            class="fill-current text-theme-text-muted"
            font-size="3.5"
            font-weight="400"
            dx={centerLine1.length === 3 ? 8.0 : centerLine1.length === 2 ? 5.8 : 3.2}
            dy="-1.2"
          >
            {centerUnit}
          </text>
        {/if}
        <text
          x={CX}
          y={CY + 4}
          text-anchor="middle"
          dominant-baseline="middle"
          class="fill-current text-theme-text-muted"
          font-size="3.5"
        >
          {centerLine2}
        </text>

        <!-- Type labels around donut (hover) -->
        {#if expanded}
          {#each typeLabels as label}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <text
              x={label.x}
              y={label.y}
              text-anchor={label.anchor}
              dominant-baseline="middle"
              font-size="3"
              class="cursor-pointer fill-current transition-colors duration-150
                {hoveredType === label.type || hoveredSegment?.type === label.type ? 'text-theme-text-emphasis font-semibold' : 'text-theme-text-muted'}"
              onmouseenter={() => handleTypeHover(label.type)}
              onmouseleave={() => { hoveredType = null; handleHoverLeave() }}
            >
              {label.displayName}
            </text>
          {/each}
        {/if}
      </svg>
    </div>
  {/if}
</div>
