<script lang="ts">
import { onMount, onDestroy } from 'svelte'
import { api } from '$lib/api'
import { dashboardStore } from '$lib/stores/dashboards'
import WidgetWrapper from './WidgetWrapper.svelte'
import Cpu from 'phosphor-svelte/lib/Cpu'
import Spinner from 'phosphor-svelte/lib/Spinner'
import type { Topology, NetworkNode } from '$lib/types'

interface Props {
  id: string
  config: {
    topologyId?: string
    title?: string
  }
  onRemove?: () => void
}

let { id, config, onRemove }: Props = $props()

let topologies: Topology[] = $state([])
let nodes: NetworkNode[] = $state([])
let nodeMetrics: Record<string, { status: 'up' | 'down' | 'unknown' }> = $state({})
let loading = $state(true)
let error = $state('')
let showSelector = $state(false)
let isHovered = $state(false)

// Group nodes by type and calculate status
interface TypeStatus {
  type: string
  displayName: string
  total: number
  up: number
  down: number
  unknown: number
  score: number // 0-100
}

let typeStatuses = $derived.by(() => {
  if (nodes.length === 0) return []

  // Group nodes by type
  const groups = new Map<string, { nodes: NetworkNode[]; up: number; down: number; unknown: number }>()

  for (const node of nodes) {
    const type = node.type || 'unknown'
    if (!groups.has(type)) {
      groups.set(type, { nodes: [], up: 0, down: 0, unknown: 0 })
    }
    const group = groups.get(type)!
    group.nodes.push(node)

    const status = nodeMetrics[node.id]?.status || 'unknown'
    if (status === 'up') group.up++
    else if (status === 'down') group.down++
    else group.unknown++
  }

  // Convert to array with scores
  const result: TypeStatus[] = []
  for (const [type, group] of groups) {
    const total = group.nodes.length
    const score = total > 0 ? Math.round((group.up / total) * 100) : 0
    result.push({
      type,
      displayName: formatTypeName(type),
      total,
      up: group.up,
      down: group.down,
      unknown: group.unknown,
      score,
    })
  }

  // Sort by total count descending
  return result.sort((a, b) => b.total - a.total)
})

// Status colors (Lighthouse style)
const STATUS_COLORS = {
  up: '#22c55e',      // green
  down: '#ef4444',    // red
  unknown: '#6b7280', // gray
}

// Overall stats
let overallStats = $derived.by(() => {
  let total = 0, up = 0, down = 0, unknown = 0
  for (const s of typeStatuses) {
    total += s.total
    up += s.up
    down += s.down
    unknown += s.unknown
  }
  const score = total > 0 ? Math.round((up / total) * 100) : 0
  return { total, up, down, unknown, score }
})

// Calculate pie segments with padAngle - by up/down/unknown status
let statusSegments = $derived.by(() => {
  const { total, up, down, unknown } = overallStats
  if (total === 0) return []

  const circumference = 2 * Math.PI * 15.5 // r=15.5
  const padAngle = 0.08 // Gap between segments (in radians, ~4.5 degrees)
  const padLength = padAngle * 15.5 // Convert to arc length

  // Count non-zero segments for padding calculation
  const statuses = [
    { status: 'up', count: up, color: STATUS_COLORS.up },
    { status: 'down', count: down, color: STATUS_COLORS.down },
    { status: 'unknown', count: unknown, color: STATUS_COLORS.unknown },
  ].filter(s => s.count > 0)

  const numSegments = statuses.length
  const totalPadding = numSegments > 1 ? padLength * numSegments : 0
  const availableLength = circumference - totalPadding

  const segments: { status: string; count: number; color: string; dashArray: string; dashOffset: number }[] = []
  let currentOffset = 0

  for (const s of statuses) {
    const ratio = s.count / total
    const length = ratio * availableLength
    segments.push({
      ...s,
      dashArray: `${length} ${circumference - length}`,
      dashOffset: -currentOffset,
    })
    currentOffset += length + (numSegments > 1 ? padLength : 0)
  }

  return segments
})

// Calculate pie segments for hover state - by device type, but with up/down/unknown colors
let typeSegments = $derived.by(() => {
  if (typeStatuses.length === 0) return []

  const total = overallStats.total
  if (total === 0) return []

  const circumference = 2 * Math.PI * 15.5
  const typePadAngle = 0.12 // Larger gap between types
  const statusPadAngle = 0.03 // Smaller gap within type
  const typePadLength = typePadAngle * 15.5
  const statusPadLength = statusPadAngle * 15.5

  // Count total segments and gaps
  let totalStatusSegments = 0
  let totalTypeGaps = 0
  for (const status of typeStatuses) {
    const statusCount = (status.up > 0 ? 1 : 0) + (status.down > 0 ? 1 : 0) + (status.unknown > 0 ? 1 : 0)
    totalStatusSegments += statusCount
    if (statusCount > 0) totalTypeGaps++
  }
  const totalStatusGaps = Math.max(0, totalStatusSegments - totalTypeGaps)

  const totalPadding = (totalTypeGaps > 1 ? typePadLength * totalTypeGaps : 0) + statusPadLength * totalStatusGaps
  const availableLength = circumference - totalPadding

  const segments: { type: string; status: string; count: number; color: string; dashArray: string; dashOffset: number }[] = []
  let currentOffset = 0
  let isFirstType = true

  for (const typeStatus of typeStatuses) {
    const statuses = [
      { status: 'up', count: typeStatus.up, color: STATUS_COLORS.up },
      { status: 'down', count: typeStatus.down, color: STATUS_COLORS.down },
      { status: 'unknown', count: typeStatus.unknown, color: STATUS_COLORS.unknown },
    ].filter(s => s.count > 0)

    if (statuses.length === 0) continue

    // Add type gap (except for first type)
    if (!isFirstType && totalTypeGaps > 1) {
      currentOffset += typePadLength
    }
    isFirstType = false

    let isFirstStatus = true
    for (const s of statuses) {
      // Add status gap within type (except for first status)
      if (!isFirstStatus) {
        currentOffset += statusPadLength
      }
      isFirstStatus = false

      const ratio = s.count / total
      const length = ratio * availableLength
      segments.push({
        type: typeStatus.type,
        status: s.status,
        count: s.count,
        color: s.color,
        dashArray: `${length} ${circumference - length}`,
        dashOffset: -currentOffset,
      })
      currentOffset += length
    }
  }

  return segments
})

// Calculate label positions for each type (center angle of the type's segments)
let typeLabels = $derived.by(() => {
  if (typeStatuses.length === 0) return []

  const total = overallStats.total
  if (total === 0) return []

  const r = 15.5
  const labelRadius = 20 // Position labels just outside the circle
  const circumference = 2 * Math.PI * r
  const typePadAngle = 0.12
  const statusPadAngle = 0.03
  const typePadLength = typePadAngle * r
  const statusPadLength = statusPadAngle * r

  // Same calculation as typeSegments to find type boundaries
  let totalStatusSegments = 0
  let totalTypeGaps = 0
  for (const status of typeStatuses) {
    const statusCount = (status.up > 0 ? 1 : 0) + (status.down > 0 ? 1 : 0) + (status.unknown > 0 ? 1 : 0)
    totalStatusSegments += statusCount
    if (statusCount > 0) totalTypeGaps++
  }
  const totalStatusGaps = Math.max(0, totalStatusSegments - totalTypeGaps)
  const totalPadding = (totalTypeGaps > 1 ? typePadLength * totalTypeGaps : 0) + statusPadLength * totalStatusGaps
  const availableLength = circumference - totalPadding

  const labels: { type: string; displayName: string; x: number; y: number; anchor: string }[] = []
  let currentOffset = 0
  let isFirstType = true

  for (const typeStatus of typeStatuses) {
    const statuses = [
      { count: typeStatus.up },
      { count: typeStatus.down },
      { count: typeStatus.unknown },
    ].filter(s => s.count > 0)

    if (statuses.length === 0) continue

    if (!isFirstType && totalTypeGaps > 1) {
      currentOffset += typePadLength
    }
    isFirstType = false

    const typeStartOffset = currentOffset

    // Calculate total length for this type
    let typeLength = 0
    let isFirstStatus = true
    for (const s of statuses) {
      if (!isFirstStatus) {
        typeLength += statusPadLength
      }
      isFirstStatus = false
      const ratio = s.count / total
      typeLength += ratio * availableLength
    }

    // Center angle for this type (convert arc length to angle)
    const centerOffset = typeStartOffset + typeLength / 2
    const angle = (centerOffset / circumference) * 2 * Math.PI - Math.PI / 2 // -90deg to start from top

    // Position on outer circle
    const x = 18 + labelRadius * Math.cos(angle)
    const y = 18 + labelRadius * Math.sin(angle)

    // Text anchor based on position
    const anchor = x > 20 ? 'start' : x < 16 ? 'end' : 'middle'

    labels.push({
      type: typeStatus.type,
      displayName: typeStatus.displayName,
      x,
      y,
      anchor,
    })

    // Update offset for next type
    currentOffset = typeStartOffset + typeLength
  }

  return labels
})

function formatTypeName(type: string): string {
  // Convert kebab-case to Title Case
  return type
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function getScoreColorClass(score: number): string {
  if (score >= 90) return 'text-success'
  if (score >= 50) return 'text-warning'
  return 'text-danger'
}

async function loadTopologies() {
  try {
    topologies = await api.topologies.list()
  } catch (err) {
    console.error('Failed to load topologies:', err)
  }
}

async function loadTopologyData() {
  if (!config.topologyId) {
    loading = false
    return
  }

  loading = true
  error = ''

  try {
    // Fetch topology context - includes nodes and metrics
    const contextRes = await fetch(`/api/topologies/${config.topologyId}/context`)
    const context = await contextRes.json()

    if (context.error) {
      throw new Error(context.error)
    }

    nodes = context.nodes || []
    // Use metrics directly from context API (not WebSocket)
    nodeMetrics = context.metrics?.nodes || {}
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
const POLL_INTERVAL_MS = 10000 // Refresh metrics every 10s

// Refresh only metrics (not nodes)
async function refreshMetrics() {
  if (!config.topologyId) return
  try {
    const contextRes = await fetch(`/api/topologies/${config.topologyId}/context`)
    const context = await contextRes.json()
    if (!context.error) {
      nodeMetrics = context.metrics?.nodes || {}
    }
  } catch {
    // Silently ignore refresh errors
  }
}

onMount(() => {
  loadTopologies()
  loadTopologyData()
  // Start polling for metrics updates
  pollInterval = setInterval(refreshMetrics, POLL_INTERVAL_MS)
})

onDestroy(() => {
  if (pollInterval) {
    clearInterval(pollInterval)
  }
})

// Watch for topology ID changes
$effect(() => {
  if (config.topologyId && config.topologyId !== lastTopologyId) {
    lastTopologyId = config.topologyId
    loadTopologyData()
  }
})

function handleSettings() {
  showSelector = !showSelector
}
</script>

<WidgetWrapper
  title={config.title || 'Device Status'}
  {onRemove}
  onSettings={handleSettings}
>
  <div class="h-full w-full relative overflow-hidden">
    {#if showSelector}
      <!-- Settings panel -->
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

        <div class="mt-auto">
          <button
            onclick={() => showSelector = false}
            class="w-full px-3 py-1.5 bg-primary text-white rounded text-sm hover:bg-primary-dark transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    {:else if !config.topologyId}
      <!-- No topology selected -->
      <div class="h-full flex flex-col items-center justify-center text-theme-text-muted gap-3">
        <Cpu size={32} />
        <span class="text-sm">No topology selected</span>
        <button
          onclick={() => showSelector = true}
          class="px-3 py-1.5 bg-primary text-white rounded text-sm hover:bg-primary-dark transition-colors"
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
        <button
          onclick={loadTopologyData}
          class="text-xs text-primary hover:underline"
        >
          Retry
        </button>
      </div>
    {:else if typeStatuses.length === 0}
      <div class="h-full flex flex-col items-center justify-center text-theme-text-muted gap-2">
        <Cpu size={32} />
        <span class="text-sm">No devices found</span>
      </div>
    {:else}
      <!-- Lighthouse-style: single circle that expands on hover -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="h-full flex flex-col items-center justify-center p-2 gap-2"
        onmouseenter={() => isHovered = true}
        onmouseleave={() => isHovered = false}
      >
        <!-- Main circular gauge - responsive size -->
        <div class="relative flex-1 w-full h-full flex items-center justify-center min-h-0 overflow-visible">
          <div class="relative w-full h-full">
            <svg
              class="w-full h-full transition-all duration-300"
              viewBox={isHovered ? "-20 -6 76 48" : "0 0 36 36"}
              preserveAspectRatio="xMidYMid meet"
            >
              <!-- Rotate group for pie chart (starts from top) -->
              <g transform="rotate(-90 18 18)">
                <!-- Background circle -->
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  class="text-theme-border opacity-30"
                />

                {#if isHovered}
                  <!-- Hover: Pie segments by device type -->
                  {#each typeSegments as seg}
                    <circle
                      cx="18"
                      cy="18"
                      r="15.5"
                      fill="none"
                      stroke={seg.color}
                      stroke-width="4"
                      stroke-dasharray={seg.dashArray}
                      stroke-dashoffset={seg.dashOffset}
                      class="transition-all duration-300"
                    />
                  {/each}
                {:else}
                  <!-- Normal: Pie segments by up/down/unknown -->
                  {#each statusSegments as seg}
                    <circle
                      cx="18"
                      cy="18"
                      r="15.5"
                      fill="none"
                      stroke={seg.color}
                      stroke-width="3"
                      stroke-dasharray={seg.dashArray}
                      stroke-dashoffset={seg.dashOffset}
                      class="transition-all duration-300"
                    />
                  {/each}
                {/if}
              </g>

              <!-- Center content (inside SVG for proper scaling) -->
              <text
                x="18"
                y="15"
                text-anchor="middle"
                dominant-baseline="middle"
                class="fill-current {getScoreColorClass(overallStats.score)}"
                font-size={isHovered ? "9" : "12"}
                font-weight="700"
              >
                {overallStats.score}
              </text>
              <text
                x="18"
                y={isHovered ? "22" : "24"}
                text-anchor="middle"
                dominant-baseline="middle"
                class="fill-current text-theme-text-muted"
                font-size={isHovered ? "3" : "4"}
              >
                {overallStats.up}/{overallStats.total}
              </text>

              <!-- Labels (not rotated) -->
              {#if isHovered}
                {#each typeLabels as label}
                  <text
                    x={label.x}
                    y={label.y}
                    text-anchor={label.anchor}
                    dominant-baseline="middle"
                    class="fill-current text-theme-text-emphasis"
                    font-size="4.5"
                    font-weight="600"
                  >
                    {label.displayName}
                  </text>
                {/each}
              {/if}
            </svg>
          </div>
        </div>

      </div>
    {/if}
  </div>
</WidgetWrapper>

