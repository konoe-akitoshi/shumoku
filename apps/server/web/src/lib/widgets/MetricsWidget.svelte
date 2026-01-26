<script lang="ts">
import { metricsData } from '$lib/stores/metrics'
import WidgetWrapper from './WidgetWrapper.svelte'
import ChartLine from 'phosphor-svelte/lib/ChartLine'
import ArrowUp from 'phosphor-svelte/lib/ArrowUp'
import ArrowDown from 'phosphor-svelte/lib/ArrowDown'

interface Props {
  id: string
  config: {
    title?: string
    metricType?: 'nodes-up' | 'nodes-down' | 'links-healthy' | 'utilization'
  }
  onConfigChange?: (config: Record<string, unknown>) => void
  onRemove?: () => void
}

let { id, config, onConfigChange, onRemove }: Props = $props()

let title = $derived(config.title || 'Metrics')
let metricType = $derived(config.metricType || 'nodes-up')

// Calculate metrics from store
let value = $derived.by(() => {
  const data = $metricsData
  if (!data) return null

  const nodeStatuses = Object.values(data.nodes)
  const linkStatuses = Object.values(data.links)

  switch (metricType) {
    case 'nodes-up':
      return nodeStatuses.filter((n) => n.status === 'up').length
    case 'nodes-down':
      return nodeStatuses.filter((n) => n.status === 'down').length
    case 'links-healthy':
      return linkStatuses.filter((l) => l.status === 'up').length
    case 'utilization':
      if (linkStatuses.length === 0) return 0
      const totalUtil = linkStatuses.reduce((sum, l) => sum + (l.utilization || 0), 0)
      return Math.round(totalUtil / linkStatuses.length)
    default:
      return 0
  }
})

let total = $derived.by(() => {
  const data = $metricsData
  if (!data) return null

  const nodeStatuses = Object.values(data.nodes)
  const linkStatuses = Object.values(data.links)

  switch (metricType) {
    case 'nodes-up':
    case 'nodes-down':
      return nodeStatuses.length
    case 'links-healthy':
      return linkStatuses.length
    case 'utilization':
      return 100
    default:
      return 0
  }
})

let colorClass = $derived.by(() => {
  switch (metricType) {
    case 'nodes-up':
    case 'links-healthy':
      return 'text-success'
    case 'nodes-down':
      return 'text-danger'
    case 'utilization':
      if (value !== null && value > 80) return 'text-warning'
      if (value !== null && value > 95) return 'text-danger'
      return 'text-primary'
    default:
      return 'text-theme-text'
  }
})

let icon = $derived.by(() => {
  switch (metricType) {
    case 'nodes-up':
    case 'links-healthy':
      return ArrowUp
    case 'nodes-down':
      return ArrowDown
    default:
      return ChartLine
  }
})

function handleSettings() {
  // Settings modal would be handled by parent
}
</script>

<WidgetWrapper {title} {onRemove} onSettings={handleSettings}>
  <div class="h-full flex flex-col items-center justify-center gap-2">
    {#if value !== null}
      <div class="flex items-center gap-2 {colorClass}">
        <svelte:component this={icon} size={24} />
        <span class="text-4xl font-bold">{value}</span>
        {#if total !== null && metricType !== 'utilization'}
          <span class="text-lg text-theme-text-muted">/ {total}</span>
        {:else if metricType === 'utilization'}
          <span class="text-lg text-theme-text-muted">%</span>
        {/if}
      </div>
      <span class="text-xs text-theme-text-muted uppercase tracking-wide">
        {#if metricType === 'nodes-up'}
          Nodes Online
        {:else if metricType === 'nodes-down'}
          Nodes Offline
        {:else if metricType === 'links-healthy'}
          Healthy Links
        {:else if metricType === 'utilization'}
          Avg Utilization
        {/if}
      </span>
    {:else}
      <div class="text-theme-text-muted flex flex-col items-center gap-2">
        <ChartLine size={32} />
        <span class="text-sm">No metrics data</span>
      </div>
    {/if}
  </div>
</WidgetWrapper>
