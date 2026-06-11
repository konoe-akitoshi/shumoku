<script lang="ts">
  import { parseWithMaps } from '@shumoku/core'
  import { page } from '$app/stores'
  import InteractiveSvgDiagram from '$lib/components/InteractiveSvgDiagram.svelte'
  import Logo from '$lib/components/Logo.svelte'
  import { metricsStore } from '$lib/stores'

  let name = $state('')
  let loading = $state(true)
  let error = $state('')
  let graphVersion = $state(0)
  let lastGraphJson = ''

  const token = $derived($page.params.token)
  // /view carries the SERVER-BAKED ResolvedLayout alongside the graph, so the
  // shared viewer never recomputes a large layout on its main thread.
  const loadShared = $derived(async () => {
    const res = await fetch(`/api/share/topologies/${token}/view`)
    if (res.status === 202) return { deriving: true }
    if (!res.ok) throw new Error(`Failed to load shared topology: ${res.status}`)
    const text = await res.text()
    lastGraphJson = text
    return parseWithMaps<Record<string, unknown>>(text)
  })

  // Structure updates are EVENT-driven: the metrics SSE stream carries
  // the topology's composition revision, and a change triggers a graph
  // refetch (re-keyed only when the payload really differs, so a
  // revision bump without visual impact doesn't flash the diagram).
  async function refetchGraph(currentToken: string): Promise<void> {
    try {
      const res = await fetch(`/api/share/topologies/${currentToken}/view`)
      if (!res.ok) return
      const text = await res.text()
      if (lastGraphJson !== '' && text !== lastGraphJson) {
        lastGraphJson = text
        graphVersion++
      } else {
        lastGraphJson = text
      }
    } catch {
      // transient network failure — keep showing the current graph
    }
  }

  $effect(() => {
    const currentToken = token
    if (!currentToken) return
    let cancelled = false
    loading = true
    error = ''
    name = ''

    ;(async () => {
      try {
        const res = await fetch(`/api/share/topologies/${currentToken}`)
        if (cancelled) return
        if (!res.ok) {
          error =
            res.status === 404 ? 'This shared link is no longer valid.' : 'Failed to load topology'
          return
        }
        const data = await res.json()
        if (cancelled) return
        name = data.name || 'Shared Topology'
        // Stream token-scoped live metrics (projected) into the diagram;
        // the same stream pushes composition-revision changes, which
        // trigger a graph refetch (structure stays in sync, no polling).
        let lastRevision: number | undefined
        metricsStore.connectShareStream(currentToken, (revision) => {
          if (lastRevision !== undefined && revision !== lastRevision) {
            void refetchGraph(currentToken)
          }
          lastRevision = revision
        })
      } catch {
        if (cancelled) return
        error = 'Failed to load topology'
      } finally {
        if (!cancelled) loading = false
      }
    })()

    return () => {
      cancelled = true
      metricsStore.disconnectShareStream()
    }
  })
</script>

<svelte:head> <title>{name || 'Shared Topology'} - Shumoku</title> </svelte:head>

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
  </div>

  <!-- Content -->
  <div class="flex-1 relative min-h-0">
    {#if loading}
      <div class="absolute inset-0 flex items-center justify-center">
        <div
          class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"
        ></div>
      </div>
    {:else if error}
      <div class="absolute inset-0 flex items-center justify-center">
        <p class="text-theme-text-muted">{error}</p>
      </div>
    {:else}
      <div class="absolute inset-0">
        {#key graphVersion}
          <InteractiveSvgDiagram graphLoader={loadShared} readOnly={true} />
        {/key}
      </div>
    {/if}
  </div>
</div>
