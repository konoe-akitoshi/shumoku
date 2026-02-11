<script lang="ts">
import { onMount } from 'svelte'
import Logo from '$lib/components/Logo.svelte'
import { page } from '$app/stores'
import InteractiveSvgDiagram from '$lib/components/InteractiveSvgDiagram.svelte'

let name = ''
let loading = true
let error = ''

$: token = $page.params.token
$: renderUrl = `/api/share/topologies/${token}/render`

onMount(async () => {
  try {
    // Fetch context to get the name (lightweight call)
    const res = await fetch(`/api/share/topologies/${token}`)
    if (!res.ok) {
      error = res.status === 404 ? 'This shared link is no longer valid.' : 'Failed to load topology'
      return
    }
    const data = await res.json()
    name = data.name || 'Shared Topology'
  } catch {
    error = 'Failed to load topology'
  } finally {
    loading = false
  }
})
</script>

<svelte:head>
  <title>{name || 'Shared Topology'} - Shumoku</title>
</svelte:head>

<div class="h-screen flex flex-col bg-theme-bg-canvas">
  <!-- Header -->
  <div class="flex items-center justify-between px-4 py-3 border-b border-theme-border bg-theme-bg-elevated">
    <div class="flex items-center gap-2">
      <Logo size={28} class="flex-shrink-0" />
      <span class="text-sm font-medium text-theme-text-emphasis">{name}</span>
      <span class="text-xs text-theme-text-muted px-2 py-0.5 bg-theme-bg rounded-full">Shared</span>
    </div>
  </div>

  <!-- Content -->
  <div class="flex-1 relative min-h-0">
    {#if loading}
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    {:else if error}
      <div class="absolute inset-0 flex items-center justify-center">
        <p class="text-theme-text-muted">{error}</p>
      </div>
    {:else}
      <div class="absolute inset-0">
        <InteractiveSvgDiagram {renderUrl} readOnly={true} />
      </div>
    {/if}
  </div>
</div>
