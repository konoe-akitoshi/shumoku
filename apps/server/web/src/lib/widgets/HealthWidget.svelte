<script lang="ts">
import { onMount } from 'svelte'
import { api } from '$lib/api'
import WidgetWrapper from './WidgetWrapper.svelte'
import Heart from 'phosphor-svelte/lib/Heart'
import CheckCircle from 'phosphor-svelte/lib/CheckCircle'
import XCircle from 'phosphor-svelte/lib/XCircle'
import Spinner from 'phosphor-svelte/lib/Spinner'

interface Props {
  id: string
  config: {
    title?: string
    showDetails?: boolean
  }
  onConfigChange?: (config: Record<string, unknown>) => void
  onRemove?: () => void
}

let { id, config, onConfigChange, onRemove }: Props = $props()

let title = $derived(config.title || 'System Health')
let showDetails = $derived(config.showDetails !== false)

interface HealthStatus {
  api: boolean
  topologies: number
  dataSources: { total: number; connected: number }
}

let health: HealthStatus | null = $state(null)
let loading = $state(true)
let error = $state('')

async function checkHealth() {
  loading = true
  error = ''

  try {
    const [apiHealth, topologies, dataSources] = await Promise.all([
      api.health.check(),
      api.topologies.list(),
      api.dataSources.list(),
    ])

    health = {
      api: apiHealth.status === 'ok',
      topologies: topologies.length,
      dataSources: {
        total: dataSources.length,
        connected: dataSources.filter((ds) => ds.status === 'connected').length,
      },
    }
  } catch (err) {
    error = err instanceof Error ? err.message : 'Health check failed'
    health = null
  } finally {
    loading = false
  }
}

onMount(() => {
  checkHealth()
  // Auto-refresh every 30 seconds
  const interval = setInterval(checkHealth, 30000)
  return () => clearInterval(interval)
})

let overallHealthy = $derived(
  health !== null &&
    health.api &&
    (health.dataSources.total === 0 || health.dataSources.connected > 0),
)

function handleSettings() {
  // Settings modal handled by parent
}
</script>

<WidgetWrapper {title} {onRemove} onSettings={handleSettings}>
  {#if loading && !health}
    <div class="h-full flex items-center justify-center">
      <Spinner size={24} class="animate-spin text-theme-text-muted" />
    </div>
  {:else if error && !health}
    <div class="h-full flex flex-col items-center justify-center text-danger gap-2">
      <XCircle size={32} />
      <span class="text-sm">{error}</span>
      <button onclick={checkHealth} class="text-xs text-primary hover:underline">Retry</button>
    </div>
  {:else if health}
    <div class="h-full flex flex-col items-center justify-center gap-3">
      <!-- Overall Status -->
      <div class="flex items-center gap-2 {overallHealthy ? 'text-success' : 'text-danger'}">
        {#if overallHealthy}
          <CheckCircle size={32} weight="fill" />
        {:else}
          <XCircle size={32} weight="fill" />
        {/if}
        <span class="text-lg font-semibold">
          {overallHealthy ? 'Healthy' : 'Degraded'}
        </span>
      </div>

      <!-- Details -->
      {#if showDetails}
        <div class="flex flex-wrap gap-4 justify-center text-sm">
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full {health.api ? 'bg-success' : 'bg-danger'}"></span>
            <span class="text-theme-text-muted">API</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="text-theme-text-emphasis font-medium">{health.topologies}</span>
            <span class="text-theme-text-muted">Topologies</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="text-theme-text-emphasis font-medium">
              {health.dataSources.connected}/{health.dataSources.total}
            </span>
            <span class="text-theme-text-muted">Data Sources</span>
          </div>
        </div>
      {/if}
    </div>
  {:else}
    <div class="h-full flex flex-col items-center justify-center text-theme-text-muted gap-2">
      <Heart size={32} />
      <span class="text-sm">No health data</span>
    </div>
  {/if}
</WidgetWrapper>
