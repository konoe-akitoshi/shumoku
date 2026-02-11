<script lang="ts">
import { auth } from '$lib/api'
import Logo from '$lib/components/Logo.svelte'
import { goto } from '$app/navigation'
import { onMount } from 'svelte'

let password = ''
let confirmPassword = ''
let error = ''
let loading = false
let isSetup = false

onMount(async () => {
  try {
    const status = await auth.status()
    if (status.authenticated) {
      goto('/')
      return
    }
    isSetup = !status.setupComplete
  } catch {
    // Server might be down
  }
})

async function handleSubmit() {
  error = ''

  if (isSetup) {
    if (password.length < 8) {
      error = 'Password must be at least 8 characters'
      return
    }
    if (password !== confirmPassword) {
      error = 'Passwords do not match'
      return
    }
  }

  if (!password) {
    error = 'Password is required'
    return
  }

  loading = true
  try {
    if (isSetup) {
      await auth.setup(password)
    } else {
      await auth.login(password)
    }
    goto('/')
  } catch (e: any) {
    error = e.message || 'Authentication failed'
  } finally {
    loading = false
  }
}
</script>

<div class="min-h-screen flex items-center justify-center bg-theme-bg-canvas">
  <div class="w-full max-w-sm mx-4">
    <div class="bg-theme-bg-elevated border border-theme-border rounded-xl p-8 shadow-lg">
      <!-- Logo -->
      <div class="flex justify-center mb-6">
        <Logo size={48} />
      </div>

      <h1 class="text-xl font-semibold text-theme-text-emphasis text-center mb-2">
        {isSetup ? 'Setup Shumoku' : 'Login'}
      </h1>

      {#if isSetup}
        <p class="text-sm text-theme-text-muted text-center mb-6">
          Set a password to protect management access.
        </p>
      {/if}

      <form onsubmit={(e) => { e.preventDefault(); handleSubmit() }} class="space-y-4">
        <div>
          <label for="password" class="block text-sm font-medium text-theme-text mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            bind:value={password}
            class="w-full px-3 py-2 bg-theme-bg-canvas border border-theme-border rounded-lg text-theme-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            placeholder={isSetup ? 'Choose a password (min 8 chars)' : 'Enter password'}
            disabled={loading}
          />
        </div>

        {#if isSetup}
          <div>
            <label for="confirm" class="block text-sm font-medium text-theme-text mb-1">
              Confirm Password
            </label>
            <input
              id="confirm"
              type="password"
              bind:value={confirmPassword}
              class="w-full px-3 py-2 bg-theme-bg-canvas border border-theme-border rounded-lg text-theme-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              placeholder="Confirm password"
              disabled={loading}
            />
          </div>
        {/if}

        {#if error}
          <div class="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">
            {error}
          </div>
        {/if}

        <button
          type="submit"
          class="w-full py-2 px-4 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          disabled={loading}
        >
          {#if loading}
            ...
          {:else if isSetup}
            Set Password
          {:else}
            Login
          {/if}
        </button>
      </form>
    </div>
  </div>
</div>
