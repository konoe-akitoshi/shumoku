<script lang="ts">
  import { onMount } from 'svelte'
  import { api } from '$lib/api'

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
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              GitHub Repository
            </a>
            <a
              href="https://shumoku-docs.dev"
              target="_blank"
              class="text-primary hover:text-primary-dark flex items-center gap-2"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              Documentation
            </a>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
