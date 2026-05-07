<script lang="ts">
  import { Tooltip } from 'bits-ui'
  import { registerBuiltinActions } from '$lib/actions/builtin'
  import { initDarkMode } from '$lib/context.svelte'
  import '../app.css'

  let { children } = $props()

  // Register the action set once on app boot. Inside `$effect` so
  // it runs in the browser only — the registry has no SSR side
  // effects.
  $effect(() => {
    registerBuiltinActions()
    return initDarkMode()
  })
</script>

<svelte:head>
  <title>Shumoku Editor</title>
  <meta name="description" content="Interactive network topology diagram editor">
</svelte:head>

<Tooltip.Provider delayDuration={200}> {@render children()} </Tooltip.Provider>
