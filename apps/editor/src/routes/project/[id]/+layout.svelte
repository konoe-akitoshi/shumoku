<script lang="ts">
  import { page } from '$app/stores'
  import NavBar from '$lib/components/NavBar.svelte'
  import { diagramState } from '$lib/context.svelte'
  import { cache } from '$lib/state/cache.svelte'

  let { children } = $props()

  const projectId = $derived($page.params.id)

  // Load project data when ID changes
  let currentProjectId = $state('')

  $effect(() => {
    if (projectId && projectId !== currentProjectId) {
      // Drain any pending cache writes from the previous project
      // before tearing it down — guarantees the mirror is in sync
      // before the in-memory state gets cleared.
      const prev = currentProjectId
      currentProjectId = projectId
      ;(async () => {
        if (prev) await cache.drain()
        await diagramState.loadProject(projectId)
      })()
    }
  })
</script>

<NavBar />
{@render children()}
