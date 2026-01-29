<script lang="ts">
import { onMount } from 'svelte'
import { api, auth } from '$lib/api'
import { themeSetting } from '$lib/stores'
import GithubLogo from 'phosphor-svelte/lib/GithubLogo'
import FileText from 'phosphor-svelte/lib/FileText'

let settings: Record<string, string> = {}
let loading = true
let error = ''

// Local settings (stored in localStorage)
let theme = 'system'
let updateInterval = '30000'

onMount(async () => {
  // Load local settings
  const localSettings = localStorage.getItem('shumoku-settings')
  if (localSettings) {
    const parsed = JSON.parse(localSettings)
    theme = parsed.theme || 'system'
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
  // Theme is managed by the store (handles DOM + localStorage)
  themeSetting.set(theme)

  // Save non-theme settings to localStorage
  const stored = localStorage.getItem('shumoku-settings')
  const settings_local = stored ? JSON.parse(stored) : {}
  settings_local.updateInterval = Number.parseInt(updateInterval, 10)
  localStorage.setItem('shumoku-settings', JSON.stringify(settings_local))
}

// Password change
let currentPassword = ''
let newPassword = ''
let confirmNewPassword = ''
let passwordError = ''
let passwordSuccess = ''
let passwordLoading = false

async function handleChangePassword() {
  passwordError = ''
  passwordSuccess = ''

  if (!currentPassword || !newPassword) {
    passwordError = 'All fields are required'
    return
  }
  if (newPassword.length < 8) {
    passwordError = 'New password must be at least 8 characters'
    return
  }
  if (newPassword !== confirmNewPassword) {
    passwordError = 'New passwords do not match'
    return
  }

  passwordLoading = true
  try {
    await auth.changePassword(currentPassword, newPassword)
    passwordSuccess = 'Password changed successfully'
    currentPassword = ''
    newPassword = ''
    confirmNewPassword = ''
  } catch (e: any) {
    passwordError = e.message || 'Failed to change password'
  } finally {
    passwordLoading = false
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
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
            <p class="text-xs text-theme-text-muted mt-1">
              System follows your OS preference.
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
              <span class="text-theme-text">{__APP_VERSION__}</span>
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

      <!-- Change Password -->
      <div class="card lg:col-span-2">
        <div class="card-header">
          <h2 class="font-medium text-theme-text-emphasis">Change Password</h2>
        </div>
        <div class="card-body">
          <form onsubmit={(e) => { e.preventDefault(); handleChangePassword() }} class="max-w-sm space-y-4">
            <div>
              <label for="currentPassword" class="label">Current Password</label>
              <input
                id="currentPassword"
                type="password"
                class="input"
                bind:value={currentPassword}
                disabled={passwordLoading}
              />
            </div>
            <div>
              <label for="newPassword" class="label">New Password</label>
              <input
                id="newPassword"
                type="password"
                class="input"
                placeholder="Min 8 characters"
                bind:value={newPassword}
                disabled={passwordLoading}
              />
            </div>
            <div>
              <label for="confirmNewPassword" class="label">Confirm New Password</label>
              <input
                id="confirmNewPassword"
                type="password"
                class="input"
                bind:value={confirmNewPassword}
                disabled={passwordLoading}
              />
            </div>

            {#if passwordError}
              <div class="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">
                {passwordError}
              </div>
            {/if}
            {#if passwordSuccess}
              <div class="text-sm text-green-500 bg-green-500/10 rounded-lg px-3 py-2">
                {passwordSuccess}
              </div>
            {/if}

            <button
              type="submit"
              class="btn btn-primary"
              disabled={passwordLoading}
            >
              {passwordLoading ? 'Changing...' : 'Change Password'}
            </button>
          </form>
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
