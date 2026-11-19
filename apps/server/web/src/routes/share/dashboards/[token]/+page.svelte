<script lang="ts">
  import { page } from '$app/state'
  import { api } from '$lib/api'
  import Logo from '$lib/components/Logo.svelte'
  import ThemeToggle from '$lib/components/ThemeToggle.svelte'
  import DashboardGrid from '$lib/dashboard/DashboardGrid.svelte'
  import { DashboardState } from '$lib/dashboard/dashboard.svelte'
  import { type DashboardLayout, parseLayout } from '$lib/dashboard/layout'
  import { readerFor } from '$lib/dashboard/reader'

  const token = $derived(page.params.token ?? '')

  let name = $state('')
  let loading = $state(true)
  let error = $state('')
  let layout = $state<DashboardLayout | null>(null)

  // Widgets read through this dashboard's token, so they work without a session (e.g. inside an
  // iframe embed). A new token is a new dashboard: the page is built again for it.
  // svelte-ignore state_referenced_locally
  const dashboard = new DashboardState(readerFor({ kind: 'shared', token }))

  async function load(shareToken: string) {
    if (!shareToken) return
    try {
      const data = await api.shared.getDashboard(shareToken)
      name = data.name || 'Shared Dashboard'
      layout = parseLayout(data.layoutJson)
    } catch {
      error = 'Failed to load dashboard'
    } finally {
      loading = false
    }
  }

  $effect(() => {
    void load(token)
  })
</script>

<svelte:head> <title>{name || 'Shared Dashboard'} - Shumoku</title> </svelte:head>

<div class="h-screen flex flex-col bg-theme-bg-canvas">
  <!-- Header -->
  <div
    class="flex items-center justify-between px-4 py-3 border-b border-theme-border bg-theme-bg-elevated"
  >
    <div class="flex items-center gap-2">
      <Logo size={28} class="flex-shrink-0" />
      <span class="text-sm font-medium text-theme-text-emphasis">{name}</span>
      <span class="text-xs text-theme-text-muted px-2 py-0.5 bg-theme-bg rounded-full">Shared</span>
    </div>
    <ThemeToggle />
  </div>

  <!-- Content -->
  <div class="flex-1 overflow-auto">
    {#if loading}
      <div class="flex items-center justify-center h-full">
        <div
          class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"
        ></div>
      </div>
    {:else if error}
      <div class="flex items-center justify-center h-full">
        <p class="text-theme-text-muted">{error}</p>
      </div>
    {:else if !layout || layout.widgets.length === 0}
      <div class="flex items-center justify-center h-full">
        <p class="text-theme-text-muted">This dashboard is empty.</p>
      </div>
    {:else}
      <div class="p-4 min-h-full">
        <DashboardGrid bind:layout {dashboard} />
      </div>
    {/if}
  </div>
</div>
