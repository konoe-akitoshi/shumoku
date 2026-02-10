<script lang="ts">
import { onMount, onDestroy } from 'svelte'
import { api } from '$lib/api'
import { dashboardStore } from '$lib/stores/dashboards'
import {
  emitHighlightByAttribute,
  emitHighlightNodes,
  emitClearHighlight,
} from '$lib/stores/widgetEvents'
import WidgetWrapper from './WidgetWrapper.svelte'
import Cpu from 'phosphor-svelte/lib/Cpu'
import Spinner from 'phosphor-svelte/lib/Spinner'
import type { Topology, NetworkNode } from '$lib/types'

// --- Props ---
interface Props {
  id: string
  config: { topologyId?: string; title?: string; showDetail?: boolean }
  onRemove?: () => void
}
let { id, config, onRemove }: Props = $props()

// --- State ---
let topologies: Topology[] = $state([])
let nodes: NetworkNode[] = $state([])
let nodeMetrics: Record<string, { status: 'up' | 'down' | 'unknown' }> = $state({})
let loading = $state(true)
let error = $state('')
let showSelector = $state(false)
let isHovered = $state(false)
let hoveredType = $state<string | null>(null)
let hoveredSegment = $state<{ type: string; status: string } | null>(null)

// --- Constants ---
const STATUS_COLORS: Record<string, string> = {
  up: '#22c55e',
  down: '#ef4444',
  unknown: '#6b7280',
}
const CX = 18, CY = 18, R = 15.5, SW = 3
const CIRC = 2 * Math.PI * R
const GAP = 0.08 * R       // gap between segments (arc length)
const TYPE_GAP = 0.14 * R  // larger gap between device types

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
  return type.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
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
      type, displayName: ts.displayName,
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
  for (let ti = 0; ti < typeStatuses.length; ti++) {
    const ts = typeStatuses[ti]
    const entries = (['up', 'down', 'unknown'] as const)
      .filter((s) => ts[s] > 0)
      .map((s) => ({ status: s, count: ts[s], color: STATUS_COLORS[s] }))
    for (let i = 0; i < entries.length; i++) {
      const isTypeBoundary = i === entries.length - 1 && ti < typeStatuses.length - 1
      items.push({ ...entries[i], type: ts.type, gap: isTypeBoundary ? TYPE_GAP : GAP })
    }
  }
  return items
}

// --- Derived data ---
let typeStatuses = $derived.by(() => {
  if (nodes.length === 0) return [] as TypeStatus[]
  const groups = new Map<string, { nodes: NetworkNode[]; up: number; down: number; unknown: number }>()
  for (const node of nodes) {
    const type = node.type || 'unknown'
    if (!groups.has(type)) groups.set(type, { nodes: [], up: 0, down: 0, unknown: 0 })
    const g = groups.get(type)!
    g.nodes.push(node)
    const s = nodeMetrics[node.id]?.status || 'unknown'
    if (s === 'up') g.up++; else if (s === 'down') g.down++; else g.unknown++
  }
  return [...groups.entries()]
    .map(([type, g]) => ({
      type, displayName: formatTypeName(type),
      total: g.nodes.length, up: g.up, down: g.down, unknown: g.unknown,
      score: g.nodes.length > 0 ? Math.round((g.up / g.nodes.length) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)
})

let overallStats = $derived.by(() => {
  let total = 0, up = 0, down = 0, unknown = 0
  for (const s of typeStatuses) { total += s.total; up += s.up; down += s.down; unknown += s.unknown }
  return { total, up, down, unknown, score: total > 0 ? Math.round((up / total) * 100) : 0 }
})

let overviewSegments = $derived.by(() => {
  const { total, up, down, unknown } = overallStats
  const items = [
    { count: up, color: STATUS_COLORS.up, gap: GAP },
    { count: down, color: STATUS_COLORS.down, gap: GAP },
    { count: unknown, color: STATUS_COLORS.unknown, gap: GAP },
  ].filter((s) => s.count > 0)
  return buildSegments(items, total)
})

let detailSegments = $derived.by(() => {
  const items = buildDetailItems()
  const active = hoveredSegment?.type ?? hoveredType
  return buildSegments(items, overallStats.total, (item) => {
    if (!active) return 1
    if (item.type !== active) return 0.2
    if (hoveredSegment && hoveredSegment.status !== item.status) return 0.5
    return 1
  })
})

let expanded = $derived(isHovered || config.showDetail)
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
  let minX = CX - R - SW, maxX = CX + R + SW
  let minY = CY - R - SW, maxY = CY + R + SW

  for (const label of typeLabels) {
    const textW = label.displayName.length * charWidth
    let lx0: number, lx1: number
    if (label.anchor === 'start') { lx0 = label.x; lx1 = label.x + textW }
    else if (label.anchor === 'end') { lx0 = label.x - textW; lx1 = label.x }
    else { lx0 = label.x - textW / 2; lx1 = label.x + textW / 2 }
    const ly0 = label.y - 2, ly1 = label.y + 2

    minX = Math.min(minX, lx0)
    maxX = Math.max(maxX, lx1)
    minY = Math.min(minY, ly0)
    maxY = Math.max(maxY, ly1)
  }

  const pad = 2
  return `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`
})

let centerLine1 = $derived.by(() => {
  if (hoveredSegment) {
    const ts = typeStatuses.find((t) => t.type === hoveredSegment!.type)
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

let centerColor = $derived.by(() => {
  if (hoveredSegment) return ''
  if (hoveredType) return scoreColorClass(typeStatuses.find((t) => t.type === hoveredType)?.score ?? 0)
  return scoreColorClass(overallStats.score)
})

// --- Hover handlers ---
function handleSegmentHover(type: string, status: string) {
  hoveredSegment = { type, status }
  hoveredType = null
  if (!config.topologyId) return
  const ids = nodes
    .filter((n) => (n.type || 'unknown') === type && (nodeMetrics[n.id]?.status || 'unknown') === status)
    .map((n) => n.id)
  if (ids.length > 0) emitHighlightNodes(config.topologyId, ids, { spotlight: true, sourceWidgetId: id })
}

function handleTypeHover(type: string) {
  hoveredSegment = null
  hoveredType = type
  if (!config.topologyId) return
  emitHighlightByAttribute(config.topologyId, 'data-device-type', type, { spotlight: true, sourceWidgetId: id })
}

function handleHoverLeave() {
  hoveredSegment = null
  hoveredType = null
  if (config.topologyId) emitClearHighlight(config.topologyId, id)
}

// --- Data loading ---
async function loadTopologies() {
  try { topologies = await api.topologies.list() } catch (err) { console.error('Failed to load topologies:', err) }
}

async function loadTopologyData() {
  if (!config.topologyId) { loading = false; return }
  loading = true
  error = ''
  try {
    const res = await fetch(`/api/topologies/${config.topologyId}/context`)
    const ctx = await res.json()
    if (ctx.error) throw new Error(ctx.error)
    nodes = ctx.nodes || []
    nodeMetrics = ctx.metrics?.nodes || {}
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load topology'
  } finally {
    loading = false
  }
}

function selectTopology(topologyId: string) {
  if (!topologyId) return
  dashboardStore.updateWidgetConfig(id, { topologyId })
  config = { ...config, topologyId }
  showSelector = false
  loadTopologyData()
}

let lastTopologyId = $state('')
let pollInterval: ReturnType<typeof setInterval> | null = null

async function refreshMetrics() {
  if (!config.topologyId) return
  try {
    const res = await fetch(`/api/topologies/${config.topologyId}/context`)
    const ctx = await res.json()
    if (!ctx.error) nodeMetrics = ctx.metrics?.nodes || {}
  } catch { /* ignore */ }
}

onMount(() => {
  loadTopologies()
  loadTopologyData()
  pollInterval = setInterval(refreshMetrics, 10000)
})

onDestroy(() => { if (pollInterval) clearInterval(pollInterval) })

$effect(() => {
  if (config.topologyId && config.topologyId !== lastTopologyId) {
    lastTopologyId = config.topologyId
    loadTopologyData()
  }
})

function handleSettings() { showSelector = !showSelector }
</script>

<WidgetWrapper
  title={config.title || 'Device Status'}
  {onRemove}
  onSettings={handleSettings}
>
  <div class="h-full w-full relative overflow-hidden">
    {#if showSelector}
      <div class="absolute inset-0 bg-theme-bg-elevated z-10 p-4 flex flex-col overflow-auto">
        <div class="text-sm font-medium text-theme-text-emphasis mb-3">Widget Settings</div>
        <label class="text-xs text-theme-text-muted mb-1">
          Topology
          <select
            value={config.topologyId || ''}
            onchange={(e) => selectTopology(e.currentTarget.value)}
            class="mt-1 w-full px-3 py-2 bg-theme-bg-canvas border border-theme-border rounded text-sm text-theme-text"
          >
            <option value="">Select topology...</option>
            {#each topologies as t}
              <option value={t.id}>{t.name}</option>
            {/each}
          </select>
        </label>
        <label class="text-xs text-theme-text-muted mb-1 mt-4">
          Title
          <input
            type="text"
            value={config.title || ''}
            onchange={(e) => dashboardStore.updateWidgetConfig(id, { title: e.currentTarget.value })}
            placeholder="Device Status"
            class="mt-1 w-full px-3 py-2 bg-theme-bg-canvas border border-theme-border rounded text-sm text-theme-text"
          />
        </label>
        <label class="flex items-center gap-2 text-xs text-theme-text-muted mt-4 cursor-pointer">
          <input
            type="checkbox"
            checked={config.showDetail ?? false}
            onchange={(e) => {
              dashboardStore.updateWidgetConfig(id, { showDetail: e.currentTarget.checked })
              config = { ...config, showDetail: e.currentTarget.checked }
            }}
            class="accent-primary"
          />
          Show detail breakdown
        </label>
        <div class="mt-auto">
          <button
            onclick={() => showSelector = false}
            class="w-full px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:bg-primary-dark transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    {:else if !config.topologyId}
      <div class="h-full flex flex-col items-center justify-center text-theme-text-muted gap-3">
        <Cpu size={32} />
        <span class="text-sm">No topology selected</span>
        <button
          onclick={() => showSelector = true}
          class="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:bg-primary-dark transition-colors"
        >
          Configure
        </button>
      </div>
    {:else if loading}
      <div class="h-full flex items-center justify-center">
        <Spinner size={24} class="animate-spin text-theme-text-muted" />
      </div>
    {:else if error}
      <div class="h-full flex flex-col items-center justify-center text-danger gap-2">
        <span class="text-sm">{error}</span>
        <button onclick={loadTopologyData} class="text-xs text-primary hover:underline">Retry</button>
      </div>
    {:else if typeStatuses.length === 0}
      <div class="h-full flex flex-col items-center justify-center text-theme-text-muted gap-2">
        <Cpu size={32} />
        <span class="text-sm">No devices found</span>
      </div>
    {:else}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="h-full w-full flex items-center justify-center p-2"
        onmouseenter={() => isHovered = true}
        onmouseleave={() => { isHovered = false; handleHoverLeave() }}
      >
        <svg class="w-full h-full transition-[viewBox] duration-300" viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
          <g transform="rotate(-90 {CX} {CY})">
            <circle
              cx={CX} cy={CY} r={R}
              fill="none" stroke="currentColor" stroke-width={SW}
              class="text-theme-border opacity-20"
            />
            {#each currentSegments as seg}
              {#if expanded && seg.type}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <circle
                  cx={CX} cy={CY} r={R} fill="none"
                  stroke={seg.color} stroke-width={SW}
                  stroke-dasharray={seg.dashArray} stroke-dashoffset={seg.dashOffset}
                  opacity={seg.opacity}
                  class="transition-opacity duration-200 cursor-pointer"
                  onmouseenter={() => handleSegmentHover(seg.type!, seg.status!)}
                  onmouseleave={() => { hoveredSegment = null; if (hoveredType) handleTypeHover(hoveredType) }}
                />
              {:else}
                <circle
                  cx={CX} cy={CY} r={R} fill="none"
                  stroke={seg.color} stroke-width={SW}
                  stroke-dasharray={seg.dashArray} stroke-dashoffset={seg.dashOffset}
                  opacity={seg.opacity}
                  class="transition-opacity duration-200"
                />
              {/if}
            {/each}
          </g>

          <!-- Center text -->
          <text
            x={CX} y={CY - 2}
            text-anchor="middle" dominant-baseline="middle"
            class="fill-current {centerColor || 'text-theme-text-emphasis'}"
            font-size="9" font-weight="700"
          >{centerLine1}</text>
          <text
            x={CX} y={CY + 4}
            text-anchor="middle" dominant-baseline="middle"
            class="fill-current text-theme-text-muted"
            font-size="3.5"
          >{centerLine2}</text>

          <!-- Type labels around donut (hover) -->
          {#if expanded}
            {#each typeLabels as label}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <text
                x={label.x} y={label.y}
                text-anchor={label.anchor} dominant-baseline="middle"
                font-size="3"
                class="cursor-pointer fill-current transition-colors duration-150
                  {hoveredType === label.type || hoveredSegment?.type === label.type ? 'text-theme-text-emphasis font-semibold' : 'text-theme-text-muted'}"
                onmouseenter={() => handleTypeHover(label.type)}
                onmouseleave={() => { hoveredType = null; handleHoverLeave() }}
              >{label.displayName}</text>
            {/each}
          {/if}
        </svg>
      </div>
    {/if}
  </div>
</WidgetWrapper>
