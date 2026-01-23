<script lang="ts">
import { api } from '$lib/api'
import * as Dialog from '$lib/components/ui/dialog'
import { Button } from '$lib/components/ui/button'
import { metricsData } from '$lib/stores'
import type { Host, ZabbixMapping } from '$lib/types'
import type { NodeSelectEvent } from './InteractiveSvgDiagram.svelte'
import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass'
import Link from 'phosphor-svelte/lib/Link'
import LinkBreak from 'phosphor-svelte/lib/LinkBreak'
import Warning from 'phosphor-svelte/lib/Warning'
import CheckCircle from 'phosphor-svelte/lib/CheckCircle'
import GearSix from 'phosphor-svelte/lib/GearSix'
import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft'

interface Props {
  open: boolean
  topologyId: string
  metricsSourceId: string | undefined
  nodeData: NodeSelectEvent | null
  currentMapping: ZabbixMapping | null
  onSaved?: (nodeId: string, mapping: { hostId?: string; hostName?: string }) => void
}

let {
  open = $bindable(false),
  topologyId,
  metricsSourceId,
  nodeData = null,
  currentMapping = null,
  onSaved,
}: Props = $props()

// View mode: 'status' shows current state, 'mapping' shows configuration
let mode = $state<'status' | 'mapping'>('status')

// State for mapping mode
let hosts = $state<Host[]>([])
let loadingHosts = $state(false)
let hostError = $state('')
let selectedHostId = $state('')
let saving = $state(false)
let searchQuery = $state('')

// Computed
let filteredHosts = $derived(
  searchQuery
    ? hosts.filter(
        (h) =>
          h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (h.displayName && h.displayName.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (h.ip && h.ip.includes(searchQuery)),
      )
    : hosts,
)

let currentNodeMapping = $derived(nodeData && currentMapping?.nodes?.[nodeData.node.id])
let hasMetricsSource = $derived(!!metricsSourceId)

// Get current metrics for this node
let nodeMetrics = $derived(nodeData ? $metricsData?.nodes?.[nodeData.node.id] : null)

// Get metrics for connected links
let linkMetricsMap = $derived(
  nodeData?.connectedLinks.reduce(
    (acc, link) => {
      const metrics = $metricsData?.links?.[link.id]
      if (metrics) {
        acc[link.id] = metrics
      }
      return acc
    },
    {} as Record<
      string,
      { status: string; utilization?: number; inUtilization?: number; outUtilization?: number }
    >,
  ) || {},
)

// Reset mode when modal opens
$effect(() => {
  if (open) {
    mode = 'status'
  }
})

// Load hosts when entering mapping mode
$effect(() => {
  if (mode === 'mapping' && metricsSourceId && hosts.length === 0) {
    loadHosts()
  }
})

// Set initial selected host when entering mapping mode
$effect(() => {
  if (mode === 'mapping' && nodeData && currentMapping) {
    const mapping = currentMapping.nodes?.[nodeData.node.id]
    selectedHostId = mapping?.hostId || ''
  }
})

async function loadHosts() {
  if (!metricsSourceId) return

  loadingHosts = true
  hostError = ''
  try {
    hosts = await api.dataSources.getHosts(metricsSourceId)
  } catch (e) {
    hostError = e instanceof Error ? e.message : 'Failed to load hosts'
  } finally {
    loadingHosts = false
  }
}

async function handleSave() {
  if (!nodeData) return

  saving = true
  try {
    const selectedHost = hosts.find((h) => h.id === selectedHostId)
    const mapping = selectedHostId ? { hostId: selectedHostId, hostName: selectedHost?.name } : {}

    await api.topologies.updateNodeMapping(topologyId, nodeData.node.id, mapping)

    if (onSaved) {
      onSaved(nodeData.node.id, mapping)
    }
    mode = 'status' // Return to status view after saving
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Failed to save mapping')
  } finally {
    saving = false
  }
}

function handleClear() {
  selectedHostId = ''
}

function handleClose() {
  open = false
  searchQuery = ''
  mode = 'status'
}

function formatUtilization(value: number | undefined): string {
  if (value === undefined) return '-'
  return `${value.toFixed(1)}%`
}

function getStatusColor(status: string | undefined): string {
  switch (status) {
    case 'up':
      return 'text-success'
    case 'down':
      return 'text-destructive'
    default:
      return 'text-muted-foreground'
  }
}

function getStatusBgColor(status: string | undefined): string {
  switch (status) {
    case 'up':
      return 'bg-success'
    case 'down':
      return 'bg-destructive'
    default:
      return 'bg-muted-foreground'
  }
}
</script>

<Dialog.Root {open} onOpenChange={(isOpen) => { if (!isOpen) handleClose() }}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2">
        {#if mode === 'mapping'}
          <button
            class="p-1 -ml-1 rounded hover:bg-muted transition-colors"
            onclick={() => (mode = 'status')}
            aria-label="Back to status"
          >
            <ArrowLeft size={16} />
          </button>
        {/if}
        {nodeData?.node.label || 'Node'}
      </Dialog.Title>
    </Dialog.Header>

    {#if nodeData}
      {#if mode === 'status'}
        <!-- STATUS VIEW -->
        <div class="space-y-4">
          <!-- Node Info & Status -->
          <div class="bg-muted/50 rounded-lg p-4 space-y-3">
            <!-- Status Row -->
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full {getStatusBgColor(nodeMetrics?.status)}"
                ></span>
                <span class="font-medium {getStatusColor(nodeMetrics?.status)}">
                  {#if nodeMetrics?.status === 'up'}
                    Up
                  {:else if nodeMetrics?.status === 'down'}
                    Down
                  {:else}
                    Unknown
                  {/if}
                </span>
              </div>
              {#if currentNodeMapping?.hostId}
                <span class="text-xs text-muted-foreground">
                  Mapped to: {currentNodeMapping.hostName || currentNodeMapping.hostId}
                </span>
              {:else}
                <span class="inline-flex items-center gap-1 text-xs text-warning">
                  <LinkBreak size={12} />
                  Not mapped
                </span>
              {/if}
            </div>

            <!-- Device Info -->
            <div class="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {#if nodeData.node.type}
                <span class="bg-background px-2 py-1 rounded">{nodeData.node.type}</span>
              {/if}
              {#if nodeData.node.vendor}
                <span class="bg-background px-2 py-1 rounded">{nodeData.node.vendor}</span>
              {/if}
              {#if nodeData.node.model}
                <span class="bg-background px-2 py-1 rounded">{nodeData.node.model}</span>
              {/if}
              {#if !nodeData.node.type && !nodeData.node.vendor && !nodeData.node.model}
                <span class="text-muted-foreground italic">No device info</span>
              {/if}
            </div>
          </div>

          <!-- Connected Links with Traffic -->
          {#if nodeData.connectedLinks.length > 0}
            <div class="space-y-2">
              <div class="flex items-center gap-2 text-sm font-medium">
                <Link size={14} />
                <span>Traffic ({nodeData.connectedLinks.length} links)</span>
              </div>
              <div class="border rounded-lg divide-y max-h-48 overflow-y-auto">
                {#each nodeData.connectedLinks as link}
                  {@const isFrom = link.from === nodeData.node.id}
                  {@const otherNode = isFrom ? link.to : link.from}
                  {@const metrics = linkMetricsMap[link.id]}
                  <div class="p-3 space-y-1">
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-medium flex items-center gap-1.5">
                        <span class="w-2 h-2 rounded-full {getStatusBgColor(metrics?.status)}"
                        ></span>
                        {isFrom ? '→' : '←'} {otherNode}
                      </span>
                      {#if link.bandwidth}
                        <span class="text-xs text-muted-foreground">{link.bandwidth}</span>
                      {/if}
                    </div>
                    {#if metrics?.utilization !== undefined}
                      <div class="flex items-center gap-2 text-xs">
                        <div class="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            class="h-full rounded-full transition-all {metrics.utilization > 80
                              ? 'bg-destructive'
                              : metrics.utilization > 50
                                ? 'bg-warning'
                                : 'bg-success'}"
                            style="width: {Math.min(metrics.utilization, 100)}%"
                          ></div>
                        </div>
                        <span class="text-muted-foreground w-12 text-right">
                          {formatUtilization(metrics.utilization)}
                        </span>
                      </div>
                      {#if metrics.inUtilization !== undefined || metrics.outUtilization !== undefined}
                        <div class="flex gap-4 text-xs text-muted-foreground">
                          <span>In: {formatUtilization(metrics.inUtilization)}</span>
                          <span>Out: {formatUtilization(metrics.outUtilization)}</span>
                        </div>
                      {/if}
                    {:else}
                      <div class="text-xs text-muted-foreground italic">No traffic data</div>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {:else}
            <div class="text-sm text-muted-foreground text-center py-4">No connected links</div>
          {/if}

          <!-- No metrics source warning -->
          {#if !hasMetricsSource}
            <div
              class="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg text-sm"
            >
              <Warning size={16} class="text-warning mt-0.5 flex-shrink-0" />
              <div class="space-y-1">
                <p class="font-medium text-warning">No metrics source configured</p>
                <p class="text-xs text-muted-foreground">
                  Configure a data source to see live metrics.
                </p>
                <a
                  href="/topologies/{topologyId}/sources"
                  class="text-xs text-primary hover:underline"
                >
                  Configure Data Sources
                </a>
              </div>
            </div>
          {/if}
        </div>

        <Dialog.Footer>
          <Button variant="outline" onclick={handleClose}>Close</Button>
          <Button variant="outline" onclick={() => (mode = 'mapping')}>
            <GearSix size={16} class="mr-1" />
            Configure Mapping
          </Button>
        </Dialog.Footer>
      {:else}
        <!-- MAPPING VIEW -->
        <div class="space-y-4">
          <!-- Current mapping status -->
          <div class="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span class="text-sm">Current mapping:</span>
            {#if currentNodeMapping?.hostId}
              <span class="text-sm font-medium flex items-center gap-1">
                <CheckCircle size={14} class="text-success" />
                {currentNodeMapping.hostName || currentNodeMapping.hostId}
              </span>
            {:else}
              <span class="text-sm text-muted-foreground flex items-center gap-1">
                <LinkBreak size={14} />
                Not mapped
              </span>
            {/if}
          </div>

          <!-- Host Selection -->
          <div class="space-y-2">
            <span class="text-sm font-medium">Select Host</span>

            {#if !hasMetricsSource}
              <div
                class="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg text-sm"
              >
                <Warning size={16} class="text-warning mt-0.5 flex-shrink-0" />
                <div class="space-y-1">
                  <p class="font-medium text-warning">No metrics source configured</p>
                  <a
                    href="/topologies/{topologyId}/sources"
                    class="text-xs text-primary hover:underline"
                  >
                    Configure Data Sources
                  </a>
                </div>
              </div>
            {:else if loadingHosts}
              <div class="flex items-center justify-center py-8">
                <div
                  class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"
                ></div>
                <span class="ml-2 text-sm text-muted-foreground">Loading hosts...</span>
              </div>
            {:else if hostError}
              <div
                class="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm"
              >
                <Warning size={16} class="text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <p class="font-medium text-destructive">Failed to load hosts</p>
                  <p class="text-xs text-muted-foreground">{hostError}</p>
                  <button class="text-xs text-primary hover:underline mt-1" onclick={loadHosts}>
                    Retry
                  </button>
                </div>
              </div>
            {:else}
              <!-- Search -->
              <div class="relative">
                <MagnifyingGlass
                  size={16}
                  class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="text"
                  placeholder="Search hosts..."
                  class="w-full pl-9 pr-3 py-2 text-sm bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  bind:value={searchQuery}
                />
              </div>

              <!-- Host List -->
              <div class="max-h-48 overflow-y-auto border rounded-md">
                {#if filteredHosts.length === 0}
                  <div class="p-3 text-sm text-muted-foreground text-center">
                    {searchQuery ? 'No hosts match your search' : 'No hosts available'}
                  </div>
                {:else}
                  <div class="divide-y">
                    {#each filteredHosts as host}
                      <label
                        class="flex items-center gap-3 p-2 hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <input
                          type="radio"
                          name="host"
                          value={host.id}
                          bind:group={selectedHostId}
                          class="w-4 h-4"
                        />
                        <div class="flex-1 min-w-0">
                          <div class="text-sm font-medium truncate">
                            {host.displayName || host.name}
                          </div>
                          {#if host.ip}
                            <div class="text-xs text-muted-foreground">{host.ip}</div>
                          {/if}
                        </div>
                        {#if host.status === 'up'}
                          <span class="w-2 h-2 bg-success rounded-full flex-shrink-0"></span>
                        {:else if host.status === 'down'}
                          <span class="w-2 h-2 bg-destructive rounded-full flex-shrink-0"></span>
                        {/if}
                      </label>
                    {/each}
                  </div>
                {/if}
              </div>

              {#if selectedHostId}
                <button
                  class="text-xs text-muted-foreground hover:text-foreground"
                  onclick={handleClear}
                >
                  Clear selection
                </button>
              {/if}
            {/if}
          </div>
        </div>

        <Dialog.Footer>
          <Button variant="outline" onclick={() => (mode = 'status')}>Cancel</Button>
          <Button onclick={handleSave} disabled={saving || !hasMetricsSource}>
            {#if saving}
              <span
                class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"
              ></span>
            {/if}
            Save
          </Button>
        </Dialog.Footer>
      {/if}
    {/if}
  </Dialog.Content>
</Dialog.Root>
