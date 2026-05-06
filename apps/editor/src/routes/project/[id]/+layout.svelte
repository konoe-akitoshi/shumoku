<script lang="ts">
  import { page } from '$app/stores'
  import NavBar from '$lib/components/NavBar.svelte'
  import { diagramState } from '$lib/context.svelte'
  import { autosave } from '$lib/state/autosave.svelte'

  let { children } = $props()

  const projectId = $derived($page.params.id)

  // Load project data when ID changes
  let currentProjectId = $state('')

  $effect(() => {
    if (projectId && projectId !== currentProjectId) {
      // Flush any pending autosave from the previous project before
      // tearing it down — prevents "edit, navigate away within 1.5s,
      // lose those edits" while the debounce was still pending.
      const prev = currentProjectId
      currentProjectId = projectId
      ;(async () => {
        if (prev) await autosave.flush()
        await diagramState.loadProject(projectId)
      })()
    }
  })
</script>

<NavBar />
{@render children()}
