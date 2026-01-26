<script lang="ts">
import { onMount } from 'svelte'
import { api } from '$lib/api'
import type { DataSource } from '$lib/types'
import WidgetWrapper from './WidgetWrapper.svelte'
import Database from 'phosphor-svelte/lib/Database'
import CheckCircle from 'phosphor-svelte/lib/CheckCircle'
import XCircle from 'phosphor-svelte/lib/XCircle'
import Question from 'phosphor-svelte/lib/Question'
import Spinner from 'phosphor-svelte/lib/Spinner'

interface Props {
  id: string
  config: {
    title?: string
    showLastChecked?: boolean
  }
  onConfigChange?: (config: Record<string, unknown>) => void
  onRemove?: () => void
}

let { id, config, onConfigChange, onRemove }: Props = $props()

let title = $derived(config.title || 'Data Sources')
let showLastChecked = $derived(config.showLastChecked !== false)

let dataSources: DataSource[] = $state([])
let loading = $state(true)
let error = $state('')

async function loadDataSources() {
  loading = true
  error = ''

  try {
    dataSources = await api.dataSources.list()
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load data sources'
  } finally {
    loading = false
  }
}

onMount(() => {
  loadDataSources()
  // Auto-refresh every 30 seconds
  const interval = setInterval(loadDataSources, 30000)
  return () => clearInterval(interval)
})

function formatTime(timestamp: number | undefined): string {
  if (!timestamp) return 'Never'
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function handleSettings() {
  // Settings modal handled by parent
}
</script>

<WidgetWrapper {title} {onRemove} onSettings={handleSettings}>
  {#if loading && dataSources.length === 0}
    <div class="h-full flex items-center justify-center">
      <Spinner size={24} class="animate-spin text-theme-text-muted" />
    </div>
  {:else if error && dataSources.length === 0}
    <div class="h-full flex flex-col items-center justify-center text-danger gap-2">
      <span class="text-sm">{error}</span>
      <button onclick={loadDataSources} class="text-xs text-primary hover:underline">
        Retry
      </button>
    </div>
  {:else if dataSources.length === 0}
    <div class="h-full flex flex-col items-center justify-center text-theme-text-muted gap-2">
      <Database size={32} />
      <span class="text-sm">No data sources</span>
    </div>
  {:else}
    <div class="space-y-2 overflow-auto max-h-full">
      {#each dataSources as ds}
        <div class="flex items-center gap-2 p-2 rounded-lg bg-theme-bg-canvas">
          <!-- Status Icon -->
          <div class="flex-shrink-0">
            {#if ds.status === 'connected'}
              <CheckCircle size={18} class="text-success" weight="fill" />
            {:else if ds.status === 'disconnected'}
              <XCircle size={18} class="text-danger" weight="fill" />
            {:else}
              <Question size={18} class="text-theme-text-muted" />
            {/if}
          </div>

          <!-- Name & Type -->
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-theme-text-emphasis truncate">
              {ds.name}
            </div>
            <div class="text-xs text-theme-text-muted flex items-center gap-2">
              <span class="uppercase">{ds.type}</span>
              {#if showLastChecked && ds.lastCheckedAt}
                <span>Last checked: {formatTime(ds.lastCheckedAt)}</span>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</WidgetWrapper>
