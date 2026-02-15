<script lang="ts">
import { onMount } from 'svelte'
import { page } from '$app/stores'
import { goto } from '$app/navigation'
import { api } from '$lib/api'
import type { DataSource, DataSourceType, ConnectionTestResult } from '$lib/types'
import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft'
import CheckCircle from 'phosphor-svelte/lib/CheckCircle'
import XCircle from 'phosphor-svelte/lib/XCircle'
import Warning from 'phosphor-svelte/lib/Warning'
import Copy from 'phosphor-svelte/lib/Copy'
import Check from 'phosphor-svelte/lib/Check'

// Get ID from route params (always defined for this route)
let id = $derived($page.params.id!)

let dataSource = $state<DataSource | null>(null)
let loading = $state(true)
let error = $state('')
let saving = $state(false)
let testResult = $state<ConnectionTestResult | null>(null)
let testing = $state(false)

// Form state
let formName = $state('')
let formUrl = $state('')
let formToken = $state('')
let formPollInterval = $state(30000)
let hasExistingToken = $state(false)
let formInsecure = $state(false)

// Grafana webhook state
let formUseWebhook = $state(false)
let webhookUrl = $state('')
let webhookLoading = $state(false)
let copied = $state(false)

interface ParsedConfig {
  url?: string
  token?: string
  pollInterval?: number
  insecure?: boolean
  useWebhook?: boolean
  webhookSecret?: string
}

function parseConfig(configJson: string): ParsedConfig {
  try {
    return JSON.parse(configJson)
  } catch {
    return {}
  }
}

function getConfigFromForm(type: DataSourceType, existingConfig?: ParsedConfig): string {
  const config: Record<string, unknown> = {
    url: formUrl.trim(),
  }

  // Only include token if user entered a new one; omit to let server preserve existing
  if (formToken.trim()) {
    config.token = formToken.trim()
  }

  if (type === 'zabbix') {
    config.pollInterval = formPollInterval
  }

  if (type === 'netbox') {
    if (formInsecure) config.insecure = true
  }

  if (type === 'grafana') {
    config.useWebhook = formUseWebhook
  }

  return JSON.stringify(config)
}

async function loadWebhookUrl() {
  if (!formUseWebhook) {
    webhookUrl = ''
    return
  }
  webhookLoading = true
  try {
    const result = await api.dataSources.getWebhookUrl(id)
    webhookUrl = `${window.location.origin}${result.webhookPath}`
  } catch (err) {
    console.error('[WebhookUrl] Failed to load:', err)
    webhookUrl = ''
  } finally {
    webhookLoading = false
  }
}

onMount(async () => {
  try {
    dataSource = await api.dataSources.get(id)
    formName = dataSource.name
    const config = parseConfig(dataSource.configJson)
    formUrl = config.url || ''
    formToken = '' // Don't show existing token
    formPollInterval = config.pollInterval || 30000
    hasExistingToken = !!config.token
    formInsecure = !!config.insecure
    formUseWebhook = !!config.useWebhook

    if (formUseWebhook) {
      await loadWebhookUrl()
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load data source'
  } finally {
    loading = false
  }
})

async function handleSave() {
  if (!formName.trim() || !formUrl.trim()) {
    error = 'Name and URL are required'
    return
  }

  saving = true
  error = ''

  try {
    // Get existing config to preserve token if not changed
    const existingConfig = dataSource ? parseConfig(dataSource.configJson) : undefined

    const updates = {
      name: formName.trim(),
      configJson: getConfigFromForm(dataSource!.type, existingConfig),
    }

    dataSource = await api.dataSources.update(id, updates)
    // Update hasExistingToken state
    const newConfig = parseConfig(dataSource.configJson)
    hasExistingToken = !!newConfig.token

    // Load webhook URL after save (secret may have been generated)
    if (dataSource.type === 'grafana' && formUseWebhook) {
      await loadWebhookUrl()
    }

    // Auto-test connection after save
    await handleTest()
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to save'
  } finally {
    saving = false
  }
}

async function handleTest() {
  testing = true
  testResult = null
  try {
    testResult = await api.dataSources.test(id)
  } catch (e) {
    testResult = {
      success: false,
      message: e instanceof Error ? e.message : 'Test failed',
    }
  }
  testing = false
}

async function handleDelete() {
  if (!confirm(`Delete data source "${dataSource?.name}"?`)) {
    return
  }
  try {
    await api.dataSources.delete(id)
    goto('/datasources')
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to delete'
  }
}
</script>

<svelte:head>
  <title>{dataSource?.name || 'Data Source'} - Shumoku</title>
</svelte:head>

<div class="p-6">
  <!-- Back link -->
  <a href="/datasources" class="inline-flex items-center gap-2 text-theme-text-muted hover:text-theme-text mb-4">
    <ArrowLeft size={16} />
    Back to Data Sources
  </a>

  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  {:else if error && !dataSource}
    <div class="card p-6 text-center">
      <p class="text-danger">{error}</p>
      <a href="/datasources" class="btn btn-secondary mt-4">Go Back</a>
    </div>
  {:else if dataSource}
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-semibold text-theme-text-emphasis">{dataSource.name}</h1>
      <button class="btn btn-danger" onclick={handleDelete}>Delete</button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Edit Form -->
      <div class="lg:col-span-2">
        <div class="card">
          <div class="card-header">
            <h2 class="font-medium text-theme-text-emphasis">Configuration</h2>
          </div>
          <form class="card-body space-y-4" onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
            {#if error}
              <div class="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
                {error}
              </div>
            {/if}

            <div>
              <label for="name" class="label">Name</label>
              <input type="text" id="name" class="input" bind:value={formName} />
            </div>

            <div>
              <label for="url" class="label">URL</label>
              <input type="url" id="url" class="input" bind:value={formUrl} />
            </div>

            {#if dataSource.type === 'zabbix' || dataSource.type === 'netbox' || dataSource.type === 'grafana'}
              <div>
                <label for="token" class="label">API Token</label>
                <input
                  type="password"
                  id="token"
                  class="input"
                  placeholder="Enter new token to update"
                  bind:value={formToken}
                />
                <p class="text-xs text-theme-text-muted mt-1">
                  {hasExistingToken ? 'Token is set. Enter a new value to update.' : 'No token set.'}
                </p>
              </div>
            {/if}

            {#if dataSource.type === 'zabbix'}
              <div>
                <label for="pollInterval" class="label">Poll Interval</label>
                <select id="pollInterval" class="input" bind:value={formPollInterval}>
                  <option value={5000}>5 seconds</option>
                  <option value={10000}>10 seconds</option>
                  <option value={30000}>30 seconds</option>
                  <option value={60000}>1 minute</option>
                  <option value={300000}>5 minutes</option>
                </select>
              </div>
            {/if}

            {#if dataSource.type === 'netbox'}
              <div class="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="insecure"
                  bind:checked={formInsecure}
                />
                <label for="insecure" class="text-sm">Skip TLS certificate verification</label>
                <p class="text-xs text-muted-foreground">(for self-signed certificates)</p>
              </div>
            {/if}

            {#if dataSource.type === 'grafana'}
              <div class="pt-2 border-t border-theme-border">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm font-medium text-theme-text-emphasis">Webhook Alerts</p>
                    <p class="text-xs text-theme-text-muted mt-0.5">
                      Receive alerts via Grafana Contact Point instead of polling Alertmanager API.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formUseWebhook}
                    aria-label="Toggle webhook alerts"
                    class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {formUseWebhook ? 'bg-primary' : 'bg-theme-border'}"
                    onclick={() => { formUseWebhook = !formUseWebhook; if (formUseWebhook) loadWebhookUrl(); else webhookUrl = ''; }}
                  >
                    <span
                      class="inline-block h-4 w-4 rounded-full bg-white transition-transform {formUseWebhook ? 'translate-x-6' : 'translate-x-1'}"
                    ></span>
                  </button>
                </div>

                {#if formUseWebhook}
                  <div class="mt-3 p-3 rounded-lg bg-theme-bg-canvas border border-theme-border">
                    {#if webhookUrl}
                      <p class="text-xs text-theme-text-muted mb-1.5">
                        Set this URL as a Grafana Contact Point (Webhook type, POST method).
                      </p>
                      <div class="flex items-center gap-2">
                        <input
                          type="text"
                          class="input flex-1 font-mono text-xs"
                          value={webhookUrl}
                          readonly
                        />
                        <button
                          type="button"
                          class="btn btn-secondary p-2"
                          title="Copy to clipboard"
                          onclick={() => { navigator.clipboard.writeText(webhookUrl); copied = true; setTimeout(() => copied = false, 2000); }}
                        >
                          {#if copied}
                            <Check size={16} class="text-success" />
                          {:else}
                            <Copy size={16} />
                          {/if}
                        </button>
                      </div>
                    {:else if webhookLoading}
                      <p class="text-xs text-theme-text-muted">Loading webhook URL...</p>
                    {:else}
                      <p class="text-xs text-theme-text-muted">
                        Click <strong>Save Changes</strong> to generate the Webhook URL.
                      </p>
                    {/if}
                  </div>
                {/if}
              </div>
            {/if}

            <div class="flex justify-end pt-4 border-t border-theme-border">
              <button type="submit" class="btn btn-primary" disabled={saving}>
                {#if saving}
                  <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></span>
                {/if}
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Connection Test -->
      <div>
        <div class="card">
          <div class="card-header">
            <h2 class="font-medium text-theme-text-emphasis">Connection Test</h2>
          </div>
          <div class="card-body">
            <button class="btn btn-secondary w-full mb-4" onclick={handleTest} disabled={testing}>
              {#if testing}
                <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></span>
              {/if}
              Test Connection
            </button>

            {#if testResult}
              <div
                class="p-4 rounded-lg {testResult.success ? 'bg-success/10' : 'bg-danger/10'}"
              >
                <div class="flex items-center gap-2 mb-2">
                  {#if testResult.success}
                    <CheckCircle size={20} class="text-success" />
                    <span class="font-medium text-success">Connected</span>
                  {:else}
                    <XCircle size={20} class="text-danger" />
                    <span class="font-medium text-danger">Failed</span>
                  {/if}
                </div>
                <p class="text-sm text-theme-text-muted">{testResult.message}</p>
                {#if testResult.version}
                  <p class="text-xs text-theme-text-muted mt-1">Version: {testResult.version}</p>
                {/if}
                {#if testResult.warnings?.length}
                  <div class="mt-2 pt-2 border-t border-warning/30">
                    {#each testResult.warnings as warning}
                      <div class="flex items-center gap-1 text-xs text-warning">
                        <Warning size={14} />
                        <span>{warning}</span>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        </div>

        <!-- Info -->
        <div class="card mt-4">
          <div class="card-header">
            <h2 class="font-medium text-theme-text-emphasis">Info</h2>
          </div>
          <div class="card-body text-sm space-y-2">
            <div class="flex justify-between">
              <span class="text-theme-text-muted">ID</span>
              <span class="font-mono text-theme-text">{dataSource.id}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-theme-text-muted">Type</span>
              <span class="text-theme-text">{dataSource.type}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-theme-text-muted">Created</span>
              <span class="text-theme-text">{new Date(dataSource.createdAt).toLocaleString()}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-theme-text-muted">Updated</span>
              <span class="text-theme-text">{new Date(dataSource.updatedAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
