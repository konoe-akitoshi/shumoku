<script lang="ts">
  /** A widget with nothing to show yet: what is missing, and a way to set it while editing. */
  import type { SquaresFourIcon } from 'phosphor-svelte'

  interface Props {
    icon: typeof SquaresFourIcon
    message: string
    openSettings?: () => void
  }

  let { icon: Icon, message, openSettings }: Props = $props()
</script>

<div class="h-full flex flex-col items-center justify-center text-theme-text-muted gap-3 p-3">
  <Icon size={32} />
  <span class="text-sm text-center">{message}</span>
  {#if openSettings}
    <button
      type="button"
      onclick={openSettings}
      class="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:bg-primary-dark transition-colors"
    >
      Configure
    </button>
  {/if}
</div>
