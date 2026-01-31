<script lang="ts">
import { onMount, onDestroy } from 'svelte'
import { api } from '$lib/api'
import type { Alert, AlertSeverity, DataSource } from '$lib/types'
import { dashboardStore, currentLayout } from '$lib/stores/dashboards'
import { emitHighlightNodes, emitClearHighlight } from '$lib/stores/widgetEvents'
import { get } from 'svelte/store'
import WidgetWrapper from './WidgetWrapper.svelte'
import * as Dialog from '$lib/components/ui/dialog'
import Warning from 'phosphor-svelte/lib/Warning'
import Fire from 'phosphor-svelte/lib/Fire'
import Info from 'phosphor-svelte/lib/Info'
import CheckCircle from 'phosphor-svelte/lib/CheckCircle'
import Spinner from 'phosphor-svelte/lib/Spinner'
import ArrowsClockwise from 'phosphor-svelte/lib/ArrowsClockwise'
import ArrowSquareOut from 'phosphor-svelte/lib/ArrowSquareOut'

interface Props {
  id: string
  config: {
    dataSourceId?: string
    title?: string
    maxItems?: number
    autoRefresh?: number
    showResolved?: boolean
  }
  onRemove?: () => void
}

let { id, config, onRemove }: Props = $props()

let alerts = $state<Alert[]>([])
let alertDataSources = $state<DataSource[]>([])
let loading = $state(true)
let error = $state<string | null>(null)
let showSelector = $state(false)
let selectedAlert = $state<Alert | null>(null)
let showDetailModal = $state(false)
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

function formatDuration(timestamp: number): string {
  const diff = Date.now() - timestamp
  if (diff < 0) return 'just now'

  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)

  if (days > 0) return `${days}d ${hours}h ${mins}m`
  if (hours > 0) return `${hours}h ${mins}m`
  if (mins > 0) return `${mins}m`
  return '<1m'
}

async function loadAlertDataSources() {
  try {
    alertDataSources = await api.dataSources.listByCapability('alerts')
  } catch (err) {
    console.error('Failed to load alert data sources:', err)
  }
}

async function loadAlerts() {
  if (!config.dataSourceId) {
    loading = false
    return
  }

  loading = true
  error = null

  try {
    // Load alerts directly from data source
    const fetchedAlerts = await api.dataSources.getAlerts(config.dataSourceId, {
      activeOnly: !config.showResolved,
    })

    // Sort by received time (webhook) descending, fallback to startTime
    alerts = fetchedAlerts.sort(
      (a, b) => (b.receivedAt ?? b.startTime) - (a.receivedAt ?? a.startTime),
    )
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load alerts'
  } finally {
    loading = false
  }
}

function selectDataSource(dataSourceId: string) {
  if (!dataSourceId) return
  dashboardStore.updateWidgetConfig(id, { dataSourceId })
  config = { ...config, dataSourceId }
  loadAlerts()
}

function forEachTopology(fn: (topologyId: string) => void) {
  const layout = get(currentLayout)
  if (!layout) return
  for (const w of layout.widgets) {
    if (w.type === 'topology' && w.config.topologyId) {
      fn(w.config.topologyId as string)
    }
  }
}

function handleAlertHover(alert: Alert) {
  if (!alert.host) return
  forEachTopology((tid) => emitHighlightNodes(tid, [alert.host!], { sourceWidgetId: id }))
}

function handleAlertLeave() {
  if (showDetailModal) return
  forEachTopology((tid) => emitClearHighlight(tid, id))
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
  loadAlertDataSources()
  loadAlerts()
  setupAutoRefresh()
})

onDestroy(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})

// Clear highlight when modal closes
$effect(() => {
  if (!showDetailModal) {
    forEachTopology((tid) => emitClearHighlight(tid, id))
  }
})

// Re-setup auto refresh when config changes
$effect(() => {
  if (config.autoRefresh !== undefined) {
    setupAutoRefresh()
  }
})

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
          <label class="text-xs text-theme-text-muted mb-1 block">Data Source</label>
          <select
            value={config.dataSourceId || ''}
            onchange={(e) => selectDataSource(e.currentTarget.value)}
            class="w-full px-3 py-2 bg-theme-bg-canvas border border-theme-border rounded text-sm text-theme-text"
          >
            <option value="">Select data source...</option>
            {#each alertDataSources as ds}
              <option value={ds.id}>{ds.name} ({ds.type})</option>
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
    {:else if !config.dataSourceId}
      <!-- No data source selected -->
      <div class="h-full flex flex-col items-center justify-center text-theme-text-muted gap-3">
        <Warning size={32} />
        <span class="text-sm">No data source selected</span>
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
              type="button"
              class="w-full text-left p-2 rounded transition-colors cursor-pointer hover:brightness-90 {SEVERITY_BG_COLORS[
                alert.severity
              ]}"
              onclick={() => { selectedAlert = alert; showDetailModal = true }}
              onmouseenter={() => handleAlertHover(alert)}
              onmouseleave={handleAlertLeave}
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
                    <span>{formatDuration(alert.receivedAt ?? alert.startTime)}</span>
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

<!-- Alert Detail Modal -->
<Dialog.Root bind:open={showDetailModal}>
  <Dialog.Content class="sm:max-w-lg">
    {#if selectedAlert}
      {@const SeverityIcon = getSeverityIcon(selectedAlert.severity)}
      <Dialog.Header>
        <div class="flex items-start gap-3">
          <div class="p-1.5 rounded {SEVERITY_BG_COLORS[selectedAlert.severity]}">
            <SeverityIcon
              size={20}
              color={SEVERITY_COLORS[selectedAlert.severity]}
              weight="fill"
            />
          </div>
          <div class="min-w-0">
            <Dialog.Title class="break-words">{selectedAlert.title}</Dialog.Title>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-xs px-1.5 py-0.5 rounded font-medium {SEVERITY_BG_COLORS[selectedAlert.severity]}" style="color: {SEVERITY_COLORS[selectedAlert.severity]}">
                {selectedAlert.severity}
              </span>
              {#if selectedAlert.status === 'active'}
                <span class="text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 font-medium">active</span>
              {:else}
                <span class="text-xs px-1.5 py-0.5 rounded bg-success/20 text-success font-medium">resolved</span>
              {/if}
              <span class="text-xs text-theme-text-muted">{selectedAlert.source}</span>
            </div>
          </div>
        </div>
      </Dialog.Header>

      <div class="space-y-4 py-2">
        {#if selectedAlert.description}
          <div>
            <div class="text-xs font-medium text-theme-text-muted mb-1">Description</div>
            <p class="text-sm text-theme-text break-words">{selectedAlert.description}</p>
          </div>
        {/if}

        <div class="grid grid-cols-2 gap-3 text-sm">
          {#if selectedAlert.host}
            <div>
              <div class="text-xs font-medium text-theme-text-muted">Host</div>
              <div class="text-theme-text font-mono">{selectedAlert.host}</div>
            </div>
          {/if}
          <div>
            <div class="text-xs font-medium text-theme-text-muted">Started</div>
            <div class="text-theme-text">{new Date(selectedAlert.startTime).toLocaleString()}</div>
          </div>
          {#if selectedAlert.endTime}
            <div>
              <div class="text-xs font-medium text-theme-text-muted">Ended</div>
              <div class="text-theme-text">{new Date(selectedAlert.endTime).toLocaleString()}</div>
            </div>
          {/if}
          <div>
            <div class="text-xs font-medium text-theme-text-muted">Duration</div>
            <div class="text-theme-text">{formatDuration(selectedAlert.startTime)}</div>
          </div>
        </div>

        {#if selectedAlert.labels && Object.keys(selectedAlert.labels).length > 0}
          <div>
            <div class="text-xs font-medium text-theme-text-muted mb-1.5">Labels</div>
            <div class="flex flex-wrap gap-1.5">
              {#each Object.entries(selectedAlert.labels) as [key, value]}
                <span class="inline-flex items-center text-xs px-2 py-0.5 rounded bg-theme-bg-canvas border border-theme-border text-theme-text">
                  <span class="text-theme-text-muted">{key}=</span>{value}
                </span>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      {#if selectedAlert.url}
        <Dialog.Footer>
          <a
            href={selectedAlert.url}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            Open in {selectedAlert.source}
            <ArrowSquareOut size={14} />
          </a>
        </Dialog.Footer>
      {/if}
    {/if}
  </Dialog.Content>
</Dialog.Root>
