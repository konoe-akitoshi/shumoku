<script lang="ts">
  import { Tooltip } from 'bits-ui'
  import '../app.css'

  let { children } = $props()
</script>

<svelte:head>
  <title>Shumoku Editor</title>
  <meta name="description" content="Interactive network topology diagram editor">
</svelte:head>

<Tooltip.Provider delayDuration={200}> {@render children()} </Tooltip.Provider>
