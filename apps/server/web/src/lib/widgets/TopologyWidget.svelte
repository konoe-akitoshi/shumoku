<script lang="ts">
import { onMount } from 'svelte'
import { api } from '$lib/api'
import type { Topology } from '$lib/types'
import WidgetWrapper from './WidgetWrapper.svelte'
import TreeStructure from 'phosphor-svelte/lib/TreeStructure'
import Spinner from 'phosphor-svelte/lib/Spinner'

interface Props {
  id: string
  config: {
    topologyId?: string
    sheetId?: string
    showMetrics?: boolean
    showLabels?: boolean
    interactive?: boolean
  }
  onConfigChange?: (config: Record<string, unknown>) => void
  onRemove?: () => void
}

let { id, config, onConfigChange, onRemove }: Props = $props()

let topology: Topology | null = $state(null)
let svgContent = $state('')
let loading = $state(true)
let error = $state('')
let lastTopologyId = $state('')

async function loadTopology() {
  if (!config.topologyId) {
    loading = false
    return
  }

  loading = true
  error = ''

  try {
    topology = await api.topologies.get(config.topologyId)

    // Fetch rendered SVG
    const renderResult = await fetch(`/api/topologies/${config.topologyId}/render`)
    const renderData = await renderResult.json()

    if (renderData.hierarchical) {
      const sheetId = config.sheetId || 'root'
      const sheet = renderData.sheets[sheetId]
      if (sheet) {
        svgContent = sheet.svg
      }
    } else {
      svgContent = renderData.svg
    }
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load topology'
  } finally {
    loading = false
  }
}

onMount(() => {
  loadTopology()
})

// Watch for topology ID changes
$effect(() => {
  if (config.topologyId && config.topologyId !== lastTopologyId) {
    lastTopologyId = config.topologyId
    loadTopology()
  }
})

function handleSettings() {
  // Settings would be handled by a modal in the parent
}
</script>

<WidgetWrapper
  title={topology?.name || 'Topology'}
  {onRemove}
  onSettings={handleSettings}
>
  {#if !config.topologyId}
    <div class="h-full flex flex-col items-center justify-center text-theme-text-muted gap-2">
      <TreeStructure size={32} />
      <span class="text-sm">Select a topology</span>
    </div>
  {:else if loading}
    <div class="h-full flex items-center justify-center">
      <Spinner size={24} class="animate-spin text-theme-text-muted" />
    </div>
  {:else if error}
    <div class="h-full flex flex-col items-center justify-center text-danger gap-2">
      <span class="text-sm">{error}</span>
      <button
        onclick={loadTopology}
        class="text-xs text-primary hover:underline"
      >
        Retry
      </button>
    </div>
  {:else if svgContent}
    <div class="h-full w-full overflow-hidden flex items-center justify-center">
      {@html svgContent}
    </div>
  {:else}
    <div class="h-full flex items-center justify-center text-theme-text-muted">
      <span class="text-sm">No content</span>
    </div>
  {/if}
</WidgetWrapper>
