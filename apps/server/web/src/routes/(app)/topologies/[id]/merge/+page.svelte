<script lang="ts">
import { onMount } from 'svelte'
import { page } from '$app/stores'
import { api } from '$lib/api'
import { Button } from '$lib/components/ui/button'
import type { Topology, TopologyDataSource } from '$lib/types'
import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft'
import ArrowDown from 'phosphor-svelte/lib/ArrowDown'
import Star from 'phosphor-svelte/lib/Star'

let topologyId = $derived($page.params.id!)

let topology = $state<Topology | null>(null)
let loading = $state(true)
let error = $state('')
let saving = $state(false)
let hasChanges = $state(false)

// Topology sources (only topology purpose)
let sources = $state<TopologyDataSource[]>([])

// Merge configuration state
let baseSourceId = $state<string | null>(null)
let overlayConfigs = $state<Record<string, OverlayConfig>>({})

// Types
type MergeMatchStrategy = 'id' | 'name' | 'attribute' | 'manual'
type MergeMergeStrategy = 'merge-properties' | 'keep-base' | 'keep-overlay'
type MergeUnmatchedStrategy = 'add-to-root' | 'add-to-subgraph' | 'ignore'

interface OverlayConfig {
  match: MergeMatchStrategy
  matchAttribute?: string
  idMapping?: Record<string, string>
  onMatch: MergeMergeStrategy
  onUnmatched: MergeUnmatchedStrategy
  subgraphName?: string
}

interface MergeConfig {
  isBase?: boolean
  match?: MergeMatchStrategy
  matchAttribute?: string
  idMapping?: Record<string, string>
  onMatch?: MergeMergeStrategy
  onUnmatched?: MergeUnmatchedStrategy
  subgraphName?: string
}

function parseMergeConfig(optionsJson?: string): MergeConfig {
  if (!optionsJson) return {}
  try {
    return JSON.parse(optionsJson)
  } catch {
    return {}
  }
}

function getOtherOptions(optionsJson?: string): Record<string, unknown> {
  if (!optionsJson) return {}
  try {
    const parsed = JSON.parse(optionsJson)
    const { isBase, match, matchAttribute, onMatch, onUnmatched, subgraphName, ...rest } = parsed
    return rest
  } catch {
    return {}
  }
}

onMount(async () => {
  try {
    const [topoData, allSources] = await Promise.all([
      api.topologies.get(topologyId),
      api.topologies.sources.list(topologyId),
    ])
    topology = topoData
    sources = allSources.filter((s) => s.purpose === 'topology')

    // Initialize state from saved config
    for (const source of sources) {
      const config = parseMergeConfig(source.optionsJson)
      if (config.isBase) {
        baseSourceId = source.dataSourceId
      } else {
        overlayConfigs[source.dataSourceId] = {
          match: config.match || 'name',
          matchAttribute: config.matchAttribute,
          idMapping: config.idMapping,
          onMatch: config.onMatch || 'merge-properties',
          onUnmatched: config.onUnmatched || 'add-to-subgraph',
          subgraphName: config.subgraphName,
        }
      }
    }

    // Default: first source is base if none specified
    if (!baseSourceId && sources.length > 0) {
      baseSourceId = sources[0].dataSourceId
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load data'
  } finally {
    loading = false
  }
})

function setBaseSource(dataSourceId: string) {
  baseSourceId = dataSourceId
  hasChanges = true
}

function updateOverlayConfig(dataSourceId: string, updates: Partial<OverlayConfig>) {
  overlayConfigs = {
    ...overlayConfigs,
    [dataSourceId]: {
      ...overlayConfigs[dataSourceId],
      ...updates,
    },
  }
  hasChanges = true
}

async function handleSave() {
  saving = true
  error = ''
  try {
    // Build updated sources with merge config in optionsJson
    const updatedSources = sources.map((source) => {
      const otherOptions = getOtherOptions(source.optionsJson)
      let mergeConfig: MergeConfig = {}

      if (source.dataSourceId === baseSourceId) {
        mergeConfig = { isBase: true }
      } else {
        const overlay = overlayConfigs[source.dataSourceId]
        if (overlay) {
          mergeConfig = {
            match: overlay.match,
            matchAttribute: overlay.matchAttribute,
            idMapping: overlay.idMapping,
            onMatch: overlay.onMatch,
            onUnmatched: overlay.onUnmatched,
            subgraphName: overlay.subgraphName,
          }
        }
      }

      // Merge with other options (like NetBox filters)
      const combined = { ...otherOptions, ...mergeConfig }
      // Clean up empty values
      Object.keys(combined).forEach((key) => {
        if (combined[key] === undefined || combined[key] === '') {
          delete combined[key]
        }
      })

      return {
        dataSourceId: source.dataSourceId,
        purpose: source.purpose,
        syncMode: source.syncMode,
        priority: source.priority,
        optionsJson: Object.keys(combined).length > 0 ? JSON.stringify(combined) : undefined,
      }
    })

    const updated = await api.topologies.sources.replaceAll(topologyId, updatedSources)
    sources = updated.filter((s) => s.purpose === 'topology')
    hasChanges = false
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to save'
  } finally {
    saving = false
  }
}

function getSourceName(dataSourceId: string): string {
  const source = sources.find((s) => s.dataSourceId === dataSourceId)
  return source?.dataSource?.name || dataSourceId
}

function getSourceType(dataSourceId: string): string {
  const source = sources.find((s) => s.dataSourceId === dataSourceId)
  return source?.dataSource?.type || 'unknown'
}

let overlaySources = $derived(sources.filter((s) => s.dataSourceId !== baseSourceId))
let baseSource = $derived(sources.find((s) => s.dataSourceId === baseSourceId))
</script>

<svelte:head>
  <title>Merge Configuration - {topology?.name || 'Topology'} - Shumoku</title>
</svelte:head>

<div class="p-6 max-w-4xl mx-auto">
  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  {:else if error && !topology}
    <div class="card p-6 text-center">
      <p class="text-danger mb-4">{error}</p>
      <a href="/topologies" class="btn btn-secondary">Back to Topologies</a>
    </div>
  {:else if topology}
    <!-- Back link -->
    <div class="mb-6">
      <a
        href="/topologies/{topologyId}/sources"
        class="inline-flex items-center gap-2 text-sm text-theme-text-muted hover:text-theme-text transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Data Sources
      </a>
    </div>

    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-semibold text-theme-text-emphasis">Merge Configuration</h1>
        <p class="text-sm text-theme-text-muted mt-1">{topology.name}</p>
      </div>
      <Button onclick={handleSave} disabled={saving || !hasChanges}>
        {#if saving}
          <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></span>
        {/if}
        Save Changes
      </Button>
    </div>

    {#if error}
      <div class="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm mb-6">
        {error}
      </div>
    {/if}

    {#if sources.length < 2}
      <div class="card p-8 text-center">
        <p class="text-theme-text-muted mb-4">
          Merge configuration requires at least 2 topology sources.
        </p>
        <a href="/topologies/{topologyId}/sources" class="text-primary hover:underline">
          Add more sources →
        </a>
      </div>
    {:else}
      <!-- Visual merge flow -->
      <div class="space-y-6">
        <!-- Base Source -->
        <div class="card">
          <div class="card-header">
            <h2 class="font-medium text-theme-text-emphasis flex items-center gap-2">
              <Star size={18} weight="fill" class="text-warning" />
              Base Source
            </h2>
            <p class="text-xs text-theme-text-muted mt-1">
              Other sources will be merged into this base
            </p>
          </div>
          <div class="card-body">
            <div class="flex flex-wrap gap-2">
              {#each sources as source}
                {@const isBase = source.dataSourceId === baseSourceId}
                <button
                  type="button"
                  class="px-4 py-2 rounded-lg border-2 transition-all cursor-pointer
                    {isBase
                      ? 'bg-warning/15 border-warning text-warning font-medium'
                      : 'bg-theme-bg-canvas border-theme-border text-theme-text-muted hover:border-theme-text-muted'}"
                  onclick={() => setBaseSource(source.dataSourceId)}
                >
                  {getSourceName(source.dataSourceId)}
                  <span class="text-xs opacity-70 ml-1">({getSourceType(source.dataSourceId)})</span>
                </button>
              {/each}
            </div>
          </div>
        </div>

        {#if overlaySources.length > 0}
          <!-- Arrow -->
          <div class="flex justify-center">
            <ArrowDown size={24} class="text-theme-text-muted" />
          </div>

          <!-- Overlay Sources -->
          <div class="card">
            <div class="card-header">
              <h2 class="font-medium text-theme-text-emphasis">Overlay Sources</h2>
              <p class="text-xs text-theme-text-muted mt-1">
                Configure how each source is merged into the base
              </p>
            </div>
            <div class="card-body space-y-6">
              {#each overlaySources as source}
                {@const config = overlayConfigs[source.dataSourceId] || {
                  match: 'name',
                  onMatch: 'merge-properties',
                  onUnmatched: 'add-to-subgraph',
                }}
                <div class="border border-theme-border rounded-lg p-4">
                  <div class="flex items-center justify-between mb-4">
                    <h3 class="font-medium text-theme-text-emphasis">
                      {getSourceName(source.dataSourceId)}
                      <span class="text-xs text-theme-text-muted font-normal ml-1">
                        ({getSourceType(source.dataSourceId)})
                      </span>
                    </h3>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <!-- Match Strategy -->
                    <div>
                      <label for="match-{source.dataSourceId}" class="text-xs text-theme-text-muted block mb-1">
                        Match Strategy
                      </label>
                      <select
                        id="match-{source.dataSourceId}"
                        class="input"
                        value={config.match}
                        onchange={(e) => updateOverlayConfig(source.dataSourceId, { match: e.currentTarget.value as MergeMatchStrategy })}
                      >
                        <option value="name">By Name</option>
                        <option value="id">By ID</option>
                        <option value="attribute">By Attribute</option>
                        <option value="manual">Manual Mapping</option>
                      </select>
                      <p class="text-xs text-theme-text-muted mt-1">
                        {#if config.match === 'name'}
                          Match nodes with the same name
                        {:else if config.match === 'id'}
                          Match nodes with the same ID
                        {:else if config.match === 'attribute'}
                          Match by a custom attribute path
                        {:else}
                          Use explicit ID mapping table
                        {/if}
                      </p>
                    </div>

                    <!-- Match Attribute (only for attribute strategy) -->
                    {#if config.match === 'attribute'}
                      <div>
                        <label for="attr-{source.dataSourceId}" class="text-xs text-theme-text-muted block mb-1">
                          Attribute Path
                        </label>
                        <input
                          type="text"
                          id="attr-{source.dataSourceId}"
                          class="input"
                          placeholder="e.g., attributes.externalId"
                          value={config.matchAttribute || ''}
                          onchange={(e) => updateOverlayConfig(source.dataSourceId, { matchAttribute: e.currentTarget.value })}
                        />
                      </div>
                    {/if}

                    <!-- ID Mapping (only for manual strategy) -->
                    {#if config.match === 'manual'}
                      <div class="md:col-span-2">
                        <label for="mapping-{source.dataSourceId}" class="text-xs text-theme-text-muted block mb-1">
                          ID Mapping (JSON)
                        </label>
                        <textarea
                          id="mapping-{source.dataSourceId}"
                          class="input font-mono text-xs"
                          rows="6"
                          placeholder={`{\n  "ocx-node-id": "netbox-node-id"\n}`}
                          value={config.idMapping ? JSON.stringify(config.idMapping, null, 2) : ''}
                          onchange={(e) => {
                            try {
                              const parsed = JSON.parse(e.currentTarget.value || '{}')
                              updateOverlayConfig(source.dataSourceId, { idMapping: parsed })
                            } catch {
                              // Invalid JSON, ignore
                            }
                          }}
                        ></textarea>
                        <p class="text-xs text-theme-text-muted mt-1">
                          Map overlay node IDs to base node IDs
                        </p>
                      </div>
                    {/if}

                    <!-- On Match behavior -->
                    <div>
                      <label for="onmatch-{source.dataSourceId}" class="text-xs text-theme-text-muted block mb-1">
                        When Matched
                      </label>
                      <select
                        id="onmatch-{source.dataSourceId}"
                        class="input"
                        value={config.onMatch}
                        onchange={(e) => updateOverlayConfig(source.dataSourceId, { onMatch: e.currentTarget.value as MergeMergeStrategy })}
                      >
                        <option value="merge-properties">Merge Properties</option>
                        <option value="keep-base">Keep Base</option>
                        <option value="keep-overlay">Keep Overlay</option>
                      </select>
                      <p class="text-xs text-theme-text-muted mt-1">
                        {#if config.onMatch === 'merge-properties'}
                          Combine properties from both sources
                        {:else if config.onMatch === 'keep-base'}
                          Keep base properties, ignore overlay
                        {:else}
                          Replace base properties with overlay
                        {/if}
                      </p>
                    </div>

                    <!-- On Unmatched behavior -->
                    <div>
                      <label for="unmatched-{source.dataSourceId}" class="text-xs text-theme-text-muted block mb-1">
                        Unmatched Nodes
                      </label>
                      <select
                        id="unmatched-{source.dataSourceId}"
                        class="input"
                        value={config.onUnmatched}
                        onchange={(e) => updateOverlayConfig(source.dataSourceId, { onUnmatched: e.currentTarget.value as MergeUnmatchedStrategy })}
                      >
                        <option value="add-to-subgraph">Add to Subgraph</option>
                        <option value="add-to-root">Add to Root</option>
                        <option value="ignore">Ignore</option>
                      </select>
                      <p class="text-xs text-theme-text-muted mt-1">
                        {#if config.onUnmatched === 'add-to-subgraph'}
                          Group under a named subgraph
                        {:else if config.onUnmatched === 'add-to-root'}
                          Add at the top level
                        {:else}
                          Skip unmatched nodes
                        {/if}
                      </p>
                    </div>

                    <!-- Subgraph name (only for add-to-subgraph) -->
                    {#if config.onUnmatched === 'add-to-subgraph'}
                      <div class="md:col-span-2">
                        <label for="subgraph-{source.dataSourceId}" class="text-xs text-theme-text-muted block mb-1">
                          Subgraph Name
                        </label>
                        <input
                          type="text"
                          id="subgraph-{source.dataSourceId}"
                          class="input"
                          placeholder={getSourceType(source.dataSourceId)}
                          value={config.subgraphName || ''}
                          onchange={(e) => updateOverlayConfig(source.dataSourceId, { subgraphName: e.currentTarget.value })}
                        />
                        <p class="text-xs text-theme-text-muted mt-1">
                          Leave empty to use source type as name
                        </p>
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <!-- Result preview hint -->
          <div class="card bg-theme-bg-subtle">
            <div class="card-body text-center py-6">
              <p class="text-sm text-theme-text-muted">
                After saving, sync from the
                <a href="/topologies/{topologyId}/sources" class="text-primary hover:underline">Data Sources</a>
                page to apply the merge.
              </p>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>
