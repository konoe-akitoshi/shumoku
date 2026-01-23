<script lang="ts">
import { onMount } from 'svelte'
import { api } from '$lib/api'
import * as Dialog from '$lib/components/ui/dialog'
import { Button } from '$lib/components/ui/button'
import type { Host, ZabbixMapping } from '$lib/types'
import type { NodeSelectEvent } from './InteractiveSvgDiagram.svelte'
import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass'
import Link from 'phosphor-svelte/lib/Link'
import LinkBreak from 'phosphor-svelte/lib/LinkBreak'
import Warning from 'phosphor-svelte/lib/Warning'
import CheckCircle from 'phosphor-svelte/lib/CheckCircle'

// Props
export let open = false
export let topologyId: string
export let metricsSourceId: string | undefined
export let nodeData: NodeSelectEvent | null = null
export let currentMapping: ZabbixMapping | null = null
export let onSaved:
  | ((nodeId: string, mapping: { hostId?: string; hostName?: string }) => void)
  | undefined = undefined

// State
let hosts: Host[] = []
let loadingHosts = false
let hostError = ''
let selectedHostId = ''
let saving = false
let searchQuery = ''

// Computed
$: filteredHosts = searchQuery
  ? hosts.filter(
      (h) =>
        h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (h.displayName && h.displayName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (h.ip && h.ip.includes(searchQuery)),
    )
  : hosts

$: currentNodeMapping = nodeData && currentMapping?.nodes?.[nodeData.node.id]
$: hasMetricsSource = !!metricsSourceId

// Load hosts when modal opens and metrics source is available
$: if (open && metricsSourceId && hosts.length === 0) {
  loadHosts()
}

// Set initial selected host when node data changes
$: if (nodeData && currentMapping) {
  const mapping = currentMapping.nodes?.[nodeData.node.id]
  selectedHostId = mapping?.hostId || ''
}

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
    open = false
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
}
</script>

<Dialog.Root bind:open onOpenChange={(isOpen) => !isOpen && handleClose()}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Node Settings</Dialog.Title>
    </Dialog.Header>

    {#if nodeData}
      <div class="space-y-4">
        <!-- Node Info -->
        <div class="bg-muted/50 rounded-lg p-3 space-y-1">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">{nodeData.node.label}</span>
            {#if currentNodeMapping?.hostId}
              <span class="inline-flex items-center gap-1 text-xs text-success">
                <CheckCircle size={12} weight="fill" />
                Mapped
              </span>
            {:else}
              <span class="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <LinkBreak size={12} />
                Not mapped
              </span>
            {/if}
          </div>
          <div class="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {#if nodeData.node.type}
              <span class="bg-background px-1.5 py-0.5 rounded">{nodeData.node.type}</span>
            {/if}
            {#if nodeData.node.vendor}
              <span class="bg-background px-1.5 py-0.5 rounded">{nodeData.node.vendor}</span>
            {/if}
            {#if nodeData.node.model}
              <span class="bg-background px-1.5 py-0.5 rounded">{nodeData.node.model}</span>
            {/if}
          </div>
        </div>

        <!-- Metrics Host Selection -->
        <div class="space-y-2">
          <span class="text-sm font-medium">Metrics Host</span>

          {#if !hasMetricsSource}
            <div class="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg text-sm">
              <Warning size={16} class="text-warning mt-0.5 flex-shrink-0" />
              <div class="space-y-1">
                <p class="font-medium text-warning">No metrics source configured</p>
                <p class="text-xs text-muted-foreground">
                  Configure a metrics data source to map nodes to hosts.
                </p>
                <a
                  href="/topologies/{topologyId}/sources"
                  class="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  Configure Data Sources
                </a>
              </div>
            </div>
          {:else if loadingHosts}
            <div class="flex items-center justify-center py-8">
              <div class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span class="ml-2 text-sm text-muted-foreground">Loading hosts...</span>
            </div>
          {:else if hostError}
            <div class="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm">
              <Warning size={16} class="text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <p class="font-medium text-destructive">Failed to load hosts</p>
                <p class="text-xs text-muted-foreground">{hostError}</p>
                <button
                  class="text-xs text-primary hover:underline mt-1"
                  onclick={loadHosts}
                >
                  Retry
                </button>
              </div>
            </div>
          {:else}
            <!-- Search -->
            <div class="relative">
              <MagnifyingGlass size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
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

        <!-- Connected Links -->
        {#if nodeData.connectedLinks.length > 0}
          <div class="space-y-2">
            <label class="text-sm font-medium flex items-center gap-1">
              <Link size={14} />
              Connected Links ({nodeData.connectedLinks.length})
            </label>
            <div class="max-h-32 overflow-y-auto border rounded-md divide-y">
              {#each nodeData.connectedLinks as link}
                {@const isFrom = link.from === nodeData.node.id}
                {@const otherNode = isFrom ? link.to : link.from}
                <div class="flex items-center justify-between p-2 text-sm">
                  <span class="text-muted-foreground">
                    {isFrom ? '→' : '←'} {otherNode}
                  </span>
                  {#if link.bandwidth}
                    <span class="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {link.bandwidth}
                    </span>
                  {/if}
                </div>
              {/each}
            </div>
            <p class="text-xs text-muted-foreground">
              Link interface mapping can be configured in the full mapping settings.
            </p>
          </div>
        {/if}
      </div>

      <Dialog.Footer>
        <Button variant="outline" onclick={handleClose}>Cancel</Button>
        <Button onclick={handleSave} disabled={saving || !hasMetricsSource}>
          {#if saving}
            <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></span>
          {/if}
          Save
        </Button>
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>
