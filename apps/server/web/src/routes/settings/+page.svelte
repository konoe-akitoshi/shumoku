<script lang="ts">
import { onMount } from 'svelte'
import { api } from '$lib/api'
import GithubLogo from 'phosphor-svelte/lib/GithubLogo'
import FileText from 'phosphor-svelte/lib/FileText'

let settings: Record<string, string> = {}
let loading = true
let error = ''
let saving = false

// Local settings (stored in localStorage)
// Default to light mode since SVG renderer doesn't fully support dark mode yet
let theme = 'light'
let updateInterval = '30000'

onMount(async () => {
  // Load local settings
  const localSettings = localStorage.getItem('shumoku-settings')
  if (localSettings) {
    const parsed = JSON.parse(localSettings)
    theme = parsed.theme || 'light'
    updateInterval = String(parsed.updateInterval || 30000)
  }

  // Load server settings
  try {
    settings = await api.settings.get()
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load settings'
  } finally {
    loading = false
  }
})

function saveLocalSettings() {
  const localSettings = {
    theme,
    updateInterval: Number.parseInt(updateInterval, 10),
  }
  localStorage.setItem('shumoku-settings', JSON.stringify(localSettings))

  // Apply theme
  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

async function handleHealthCheck() {
  try {
    const result = await api.health.check()
    alert(`Server is ${result.status} (timestamp: ${new Date(result.timestamp).toLocaleString()})`)
  } catch (e) {
    alert(`Health check failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
  }
}
</script>

<svelte:head>
  <title>Settings - Shumoku</title>
</svelte:head>

<div class="p-6">
  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  {:else}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Display Settings -->
      <div class="card">
        <div class="card-header">
          <h2 class="font-medium text-theme-text-emphasis">Display Settings</h2>
        </div>
        <div class="card-body space-y-4">
          <div>
            <label for="theme" class="label">Theme</label>
            <select id="theme" class="input" bind:value={theme} onchange={saveLocalSettings}>
              <option value="light">Light</option>
              <option value="dark">Dark (Beta)</option>
            </select>
            <p class="text-xs text-theme-text-muted mt-1">
              Dark mode is in beta. Topology diagrams may not display correctly.
            </p>
          </div>

          <div>
            <label for="updateInterval" class="label">Update Interval</label>
            <select id="updateInterval" class="input" bind:value={updateInterval} onchange={saveLocalSettings}>
              <option value="5000">5 seconds</option>
              <option value="10000">10 seconds</option>
              <option value="30000">30 seconds</option>
              <option value="60000">1 minute</option>
              <option value="300000">5 minutes</option>
            </select>
            <p class="text-xs text-theme-text-muted mt-1">How often to refresh metrics data</p>
          </div>

          <p class="text-xs text-theme-text-muted pt-2 border-t border-theme-border">
            These settings are saved to your browser's local storage.
          </p>
        </div>
      </div>

      <!-- Server Info -->
      <div class="card">
        <div class="card-header">
          <h2 class="font-medium text-theme-text-emphasis">Server Information</h2>
        </div>
        <div class="card-body">
          <div class="space-y-3">
            <div class="flex justify-between">
              <span class="text-theme-text-muted">Version</span>
              <span class="text-theme-text">0.1.0</span>
            </div>
            <div class="flex justify-between">
              <span class="text-theme-text-muted">Database</span>
              <span class="text-theme-text">SQLite</span>
            </div>
          </div>

          <div class="mt-4 pt-4 border-t border-theme-border">
            <button class="btn btn-secondary w-full" onclick={handleHealthCheck}>
              Check Server Health
            </button>
          </div>
        </div>
      </div>

      <!-- About -->
      <div class="card lg:col-span-2">
        <div class="card-header">
          <h2 class="font-medium text-theme-text-emphasis">About Shumoku</h2>
        </div>
        <div class="card-body">
          <p class="text-theme-text-muted mb-4">
            Shumoku is a modern network topology visualization library for Markdown.
            It enables network engineers to create interactive network diagrams directly in documentation.
          </p>
          <div class="flex items-center gap-4">
            <a
              href="https://github.com/shumoku/shumoku"
              target="_blank"
              class="text-primary hover:text-primary-dark flex items-center gap-2"
            >
              <GithubLogo size={20} />
              GitHub Repository
            </a>
            <a
              href="https://shumoku-docs.dev"
              target="_blank"
              class="text-primary hover:text-primary-dark flex items-center gap-2"
            >
              <FileText size={20} />
              Documentation
            </a>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
