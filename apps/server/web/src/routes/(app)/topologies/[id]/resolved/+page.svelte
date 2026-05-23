<script lang="ts">
  /**
   * Resolved-graph viewer. Shows the JSON output of `resolve()` over
   * Manual + every attached source's latest snapshot — the exact
   * shape the diagram renders. Debug / inspection surface.
   *
   * Could arguably be a button on the Settings page instead of a
   * top-level tab; kept as a tab for now because it's the only place
   * to see "what is the resolver actually producing right now".
   */
  import { onMount } from 'svelte'
  import { api } from '$lib/api'
  import { Button } from '$lib/components/ui/button'
  import { useTopologyCtx } from '../_context.svelte'

  const ctx = useTopologyCtx()

  let resolvedJson = $state('')
  let snapshotCount = $state(0)
  let loading = $state(false)
  let error = $state('')
  let copied = $state(false)

  onMount(() => {
    void load()
  })

  // Refetch if the user navigates between topologies without unmounting
  // (SvelteKit keeps the page mounted across [id] changes since it's
  // the same route component).
  $effect(() => {
    if (ctx.topologyId) void load()
  })

  async function load() {
    if (!ctx.topologyId) return
    loading = true
    error = ''
    try {
      const { graph, snapshotCount: n } = await api.topologies.getResolved(ctx.topologyId)
      resolvedJson = JSON.stringify(graph, null, 2)
      snapshotCount = n
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load resolved graph'
    } finally {
      loading = false
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(resolvedJson)
      copied = true
      setTimeout(() => {
        copied = false
      }, 1500)
    } catch (e) {
      console.error('[Resolved] Copy failed:', e)
    }
  }
</script>

<div class="container mx-auto p-6 max-w-6xl space-y-3">
  <div class="flex items-start justify-between">
    <div>
      <h2 class="font-medium text-theme-text-emphasis">Resolved project graph</h2>
      <p class="text-sm text-theme-text-muted mt-0.5">
        Output of <code>resolve()</code> over Manual + every attached source's latest snapshot. This
        is the JSON the diagram renders.
        {#if snapshotCount > 0}
          <span class="text-xs">
            ({snapshotCount}
            source snapshot{snapshotCount === 1 ? '' : 's'}
            folded in)
          </span>
        {/if}
      </p>
    </div>
    <Button variant="outline" size="sm" onclick={copy} disabled={!resolvedJson || loading}>
      {copied ? 'Copied ✓' : 'Copy'}
    </Button>
  </div>

  {#if error}
    <div class="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
      {error}
    </div>
  {/if}

  <div class="card">
    {#if loading && !resolvedJson}
      <div class="card-body flex items-center justify-center py-12">
        <div
          class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"
        ></div>
      </div>
    {:else if !resolvedJson}
      <div class="card-body text-sm text-theme-text-muted text-center">No resolved graph yet.</div>
    {:else}
      <pre
        class="p-4 text-xs font-mono overflow-auto max-h-[70vh] text-theme-text"
      ><code>{resolvedJson}</code></pre>
    {/if}
  </div>
</div>
