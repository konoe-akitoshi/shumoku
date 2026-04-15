<script lang="ts">
  import { Tooltip } from 'bits-ui'
  import { initDarkMode } from '$lib/context.svelte'
  import '../app.css'

  let { children } = $props()

  $effect(() => {
    return initDarkMode()
  })
</script>

<svelte:head>
  <title>Shumoku Editor</title>
  <meta name="description" content="Interactive network topology diagram editor">
</svelte:head>

<Tooltip.Provider delayDuration={200}> {@render children()} </Tooltip.Provider>
