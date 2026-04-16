<script lang="ts">
  import { page } from '$app/stores'
  import NavBar from '$lib/components/NavBar.svelte'
  import { diagramState } from '$lib/context.svelte'

  let { children } = $props()

  const projectId = $derived($page.params.id)

  // Load project data when ID changes
  let currentProjectId = $state('')

  $effect(() => {
    if (projectId && projectId !== currentProjectId) {
      currentProjectId = projectId
      diagramState.loadProject(projectId)
    }
  })
</script>

<NavBar />
{@render children()}
