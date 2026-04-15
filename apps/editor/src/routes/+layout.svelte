<script lang="ts">
  import { Tooltip } from 'bits-ui'
  import NavBar from '$lib/components/NavBar.svelte'
  import { diagramState, initDarkMode } from '$lib/context.svelte'
  import '../app.css'

  let { children } = $props()

  $effect(() => {
    return initDarkMode()
  })

  $effect(() => {
    diagramState.initialize()
  })
</script>

<svelte:head>
  <title>Shumoku Editor</title>
  <meta name="description" content="Interactive network topology diagram editor">
</svelte:head>

<Tooltip.Provider delayDuration={200}>
  <NavBar />
  {@render children()}
</Tooltip.Provider>
