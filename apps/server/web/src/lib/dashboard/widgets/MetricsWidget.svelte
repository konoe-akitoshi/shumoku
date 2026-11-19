<script lang="ts">
  /** One figure from a topology's live feed: nodes up or down, healthy links, mean utilization. */
  import { ArrowDownIcon, ArrowUpIcon, ChartLineIcon } from 'phosphor-svelte'
  import { preferences, watchTopologyLive } from '$lib/stores'
  import { useDashboard } from '../dashboard.svelte'
  import { configString, type WidgetProps } from '../widget-types'
  import WidgetEmpty from './WidgetEmpty.svelte'

  type MetricType = 'nodes-up' | 'nodes-down' | 'links-healthy' | 'utilization'

  let { config, openSettings }: WidgetProps = $props()
  const { reader } = useDashboard()

  const topologyId = $derived(configString(config, 'topologyId'))
  const metricType = $derived((configString(config, 'metricType') ?? 'nodes-up') as MetricType)

  const live = watchTopologyLive(() =>
    preferences.liveUpdates && topologyId ? reader.liveSource(topologyId) : null,
  )

  const LABELS: Record<MetricType, string> = {
    'nodes-up': 'Nodes Online',
    'nodes-down': 'Nodes Offline',
    'links-healthy': 'Healthy Links',
    utilization: 'Avg Utilization',
  }

  /** The figure, and what it is out of (`null` for a percentage). */
  const reading = $derived.by((): { value: number; total: number | null } | null => {
    const data = live.metrics
    if (!data) return null
    const nodes = Object.values(data.nodes)
    const links = Object.values(data.links)
    switch (metricType) {
      case 'nodes-up':
        return { value: nodes.filter((n) => n.status === 'up').length, total: nodes.length }
      case 'nodes-down':
        return { value: nodes.filter((n) => n.status === 'down').length, total: nodes.length }
      case 'links-healthy':
        return { value: links.filter((l) => l.status === 'up').length, total: links.length }
      case 'utilization': {
        const sum = links.reduce((s, l) => s + (l.utilization ?? 0), 0)
        return { value: links.length ? Math.round(sum / links.length) : 0, total: null }
      }
      default:
        return null
    }
  })

  const colorClass = $derived.by(() => {
    switch (metricType) {
      case 'nodes-up':
      case 'links-healthy':
        return 'text-success'
      case 'nodes-down':
        return 'text-danger'
      case 'utilization': {
        // The higher threshold first, or it is never reached.
        const value = reading?.value ?? 0
        if (value > 95) return 'text-danger'
        if (value > 80) return 'text-warning'
        return 'text-primary'
      }
      default:
        return 'text-theme-text'
    }
  })

  const Icon = $derived(
    metricType === 'nodes-down'
      ? ArrowDownIcon
      : metricType === 'utilization'
        ? ChartLineIcon
        : ArrowUpIcon,
  )
</script>

{#if !topologyId}
  <WidgetEmpty icon={ChartLineIcon} message="No topology selected" {openSettings} />
{:else}
  <div class="h-full flex flex-col items-center justify-center gap-2">
    {#if reading}
      <div class="flex items-center gap-2 {colorClass}">
        <Icon />
        <span class="text-4xl font-bold">{reading.value}</span>
        <span class="text-lg text-theme-text-muted">
          {reading.total === null ? '%' : `/ ${reading.total}`}
        </span>
      </div>
      <span class="text-xs text-theme-text-muted uppercase tracking-wide">
        {LABELS[metricType]}
      </span>
    {:else}
      <div class="text-theme-text-muted flex flex-col items-center gap-2">
        <ChartLineIcon size={32} />
        <span class="text-sm">No metrics data</span>
      </div>
    {/if}
  </div>
{/if}
