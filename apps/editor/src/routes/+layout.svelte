<script lang="ts">
  import { Tooltip } from 'bits-ui'
  import { registerBuiltinActions } from '$lib/actions/builtin'
  import { installKeyboardShortcuts } from '$lib/actions/keyboard'
  import { initDarkMode } from '$lib/context.svelte'
  import '../app.css'

  let { children } = $props()

  // Register the action set + install the global keyboard handler
  // once on app boot. Inside `$effect` so it runs in the browser
  // only — the registry / window listeners have no SSR side
  // effects.
  $effect(() => {
    registerBuiltinActions()
    const detachKeys = installKeyboardShortcuts()
    const detachDarkMode = initDarkMode()
    return () => {
      detachKeys()
      detachDarkMode?.()
    }
  })
</script>

<svelte:head>
  <title>Shumoku Editor</title>
  <meta name="description" content="Interactive network topology diagram editor">
</svelte:head>

<Tooltip.Provider delayDuration={200}> {@render children()} </Tooltip.Provider>
