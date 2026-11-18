<script lang="ts">
  import { MoonIcon, SunIcon } from 'phosphor-svelte'
  import { preferences } from '$lib/stores/preferences.svelte'
</script>

<!-- Switches between light and dark. The choice is the viewer's, kept in this browser, and every
     open tab (shared pages included) follows it. -->
<button
  onclick={() => preferences.toggleTheme()}
  class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-theme-bg transition-colors text-theme-text-muted hover:text-theme-text cursor-pointer"
  aria-label={preferences.resolvedTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
>
  {#if preferences.resolvedTheme === 'dark'}
    <MoonIcon size={20} />
  {:else}
    <SunIcon size={20} />
  {/if}
</button>
