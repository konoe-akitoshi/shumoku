<script lang="ts">
import { onMount, onDestroy } from 'svelte'
import { api } from '$lib/api'
import type { Alert, AlertSeverity, Topology } from '$lib/types'
import { dashboardStore, dashboardEditMode } from '$lib/stores/dashboards'
import { emitZoomToNode, emitHighlightNode } from '$lib/stores/widgetEvents'
import WidgetWrapper from './WidgetWrapper.svelte'
import Warning from 'phosphor-svelte/lib/Warning'
import Fire from 'phosphor-svelte/lib/Fire'
import Info from 'phosphor-svelte/lib/Info'
import CheckCircle from 'phosphor-svelte/lib/CheckCircle'
import Spinner from 'phosphor-svelte/lib/Spinner'
import ArrowsClockwise from 'phosphor-svelte/lib/ArrowsClockwise'

interface Props {
  id: string
  config: {
    topologyId?: string
    title?: string
    maxItems?: number
    autoRefresh?: number
    showResolved?: boolean
  }
  onRemove?: () => void
}

let { id, config, onRemove }: Props = $props()

let alerts = $state<Alert[]>([])
let topologies = $state<Topology[]>([])
let topology = $state<Topology | null>(null)
let loading = $state(true)
let error = $state<string | null>(null)
let showSelector = $state(false)
let refreshInterval: ReturnType<typeof setInterval> | null = null

// Severity configuration
const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  disaster: '#dc2626', // red-600
  high: '#ea580c', // orange-600
  average: '#ca8a04', // yellow-600
  warning: '#0284c7', // sky-600
  information: '#16a34a', // green-600
  ok: '#6b7280', // gray-500
}

const SEVERITY_BG_COLORS: Record<AlertSeverity, string> = {
  disaster: 'bg-red-500/10',
  high: 'bg-orange-500/10',
  average: 'bg-yellow-500/10',
  warning: 'bg-sky-500/10',
  information: 'bg-green-500/10',
  ok: 'bg-gray-500/10',
}

const SEVERITY_ORDER: AlertSeverity[] = [
  'disaster',
  'high',
  'average',
  'warning',
  'information',
  'ok',
]

function getSeverityIcon(severity: AlertSeverity) {
  switch (severity) {
    case 'disaster':
      return Fire
    case 'high':
    case 'average':
      return Warning
    case 'warning':
    case 'information':
      return Info
    case 'ok':
      return CheckCircle
    default:
      return Warning
  }
}

function formatTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 60000) {
    return 'just now'
  }
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000)
    return `${mins}m ago`
  }
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000)
    return `${hours}h ago`
  }

  const date = new Date(timestamp)
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function loadTopologies() {
  try {
    topologies = await api.topologies.list()
  } catch (err) {
    console.error('Failed to load topologies:', err)
  }
}

async function loadAlerts() {
  if (!config.topologyId) {
    loading = false
    return
  }

  loading = true
  error = null

  try {
    // Load topology info for display
    topology = await api.topologies.get(config.topologyId)

    // Load alerts
    const fetchedAlerts = await api.topologies.getAlerts(config.topologyId, {
      activeOnly: !config.showResolved,
    })

    // Sort by severity then by time
    alerts = fetchedAlerts.sort((a, b) => {
      const severityDiff =
        SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
      if (severityDiff !== 0) return severityDiff
      return b.startTime - a.startTime
    })
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load alerts'
  } finally {
    loading = false
  }
}

function selectTopology(topologyId: string) {
  if (!topologyId) return
  dashboardStore.updateWidgetConfig(id, { topologyId })
  config = { ...config, topologyId }
  showSelector = false
  loadAlerts()
}

function handleAlertClick(alert: Alert) {
  if (alert.nodeId && config.topologyId) {
    // Emit zoom and highlight events
    emitZoomToNode(config.topologyId, alert.nodeId, id)
    emitHighlightNode(config.topologyId, alert.nodeId, 3000, id)
  }
}

function handleRefresh() {
  loadAlerts()
}

function handleSettings() {
  showSelector = !showSelector
}

function setupAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }

  const interval = config.autoRefresh || 30
  if (interval > 0) {
    refreshInterval = setInterval(loadAlerts, interval * 1000)
  }
}

onMount(() => {
  loadTopologies()
  loadAlerts()
  setupAutoRefresh()
})

onDestroy(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})

// Re-setup auto refresh when config changes
$effect(() => {
  if (config.autoRefresh !== undefined) {
    setupAutoRefresh()
  }
})

let editMode = $derived($dashboardEditMode)
let displayedAlerts = $derived(alerts.slice(0, config.maxItems || 10))
let activeAlerts = $derived(alerts.filter((a) => a.status === 'active'))
</script>

<WidgetWrapper
  title={config.title || 'Alerts'}
  {onRemove}
  onSettings={handleSettings}
>
  <div class="h-full flex flex-col">
    {#if showSelector}
      <!-- Settings panel -->
      <div class="flex flex-col gap-4">
        <div class="text-sm font-medium text-theme-text-emphasis">Widget Settings</div>

        <div>
          <label class="text-xs text-theme-text-muted mb-1 block">Topology</label>
          <select
            value={config.topologyId || ''}
            onchange={(e) => selectTopology(e.currentTarget.value)}
            class="w-full px-3 py-2 bg-theme-bg-canvas border border-theme-border rounded text-sm text-theme-text"
          >
            <option value="">Select topology...</option>
            {#each topologies as t}
              <option value={t.id}>{t.name}</option>
            {/each}
          </select>
        </div>

        <button
          onclick={() => (showSelector = false)}
          class="w-full px-3 py-1.5 bg-primary text-white rounded text-sm hover:bg-primary-dark transition-colors"
        >
          Done
        </button>
      </div>
    {:else if !config.topologyId}
      <!-- No topology selected -->
      <div class="h-full flex flex-col items-center justify-center text-theme-text-muted gap-3">
        <Warning size={32} />
        <span class="text-sm">No topology selected</span>
        <button
          onclick={() => (showSelector = true)}
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
        <button onclick={handleRefresh} class="text-xs text-primary hover:underline">
          Retry
        </button>
      </div>
    {:else}
      <!-- Header with count and refresh -->
      <div class="flex items-center justify-between mb-2">
        <div class="text-xs text-theme-text-muted">
          {#if activeAlerts.length > 0}
            <span class="text-danger font-medium">{activeAlerts.length}</span> active
          {:else}
            No active alerts
          {/if}
        </div>
        <button
          onclick={handleRefresh}
          class="p-1 rounded hover:bg-theme-bg-canvas text-theme-text-muted hover:text-theme-text transition-colors"
          title="Refresh alerts"
        >
          <ArrowsClockwise size={14} />
        </button>
      </div>

      <!-- Alert list -->
      {#if displayedAlerts.length === 0}
        <div
          class="flex-1 flex flex-col items-center justify-center text-theme-text-muted gap-2"
        >
          <CheckCircle size={32} class="text-success" />
          <span class="text-sm">All clear</span>
        </div>
      {:else}
        <div class="flex-1 overflow-y-auto space-y-1">
          {#each displayedAlerts as alert}
            {@const SeverityIcon = getSeverityIcon(alert.severity)}
            <button
              class="w-full text-left p-2 rounded transition-colors {SEVERITY_BG_COLORS[
                alert.severity
              ]} hover:brightness-90 {alert.nodeId
                ? 'cursor-pointer'
                : 'cursor-default opacity-75'}"
              onclick={() => handleAlertClick(alert)}
              disabled={!alert.nodeId}
              title={alert.nodeId ? 'Click to zoom to node' : 'No node mapping'}
            >
              <div class="flex items-start gap-2">
                <SeverityIcon
                  size={16}
                  color={SEVERITY_COLORS[alert.severity]}
                  weight="fill"
                  class="mt-0.5 flex-shrink-0"
                />
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium truncate text-theme-text">
                    {alert.title}
                  </div>
                  <div class="text-xs text-theme-text-muted flex items-center gap-1.5 mt-0.5">
                    {#if alert.host}
                      <span class="truncate max-w-[100px]">{alert.host}</span>
                      <span>-</span>
                    {/if}
                    <span>{formatTime(alert.startTime)}</span>
                    {#if alert.status === 'resolved'}
                      <span
                        class="px-1 py-0.5 text-[10px] bg-success/20 text-success rounded"
                        >resolved</span
                      >
                    {/if}
                  </div>
                </div>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</WidgetWrapper>
