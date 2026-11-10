<script lang="ts">
  import { GlobeIcon, SpinnerIcon } from 'phosphor-svelte'
  import WidgetWrapper from './WidgetWrapper.svelte'

  interface Props {
    config: {
      title?: string
      url?: string
      path?: string
    }
    onRemove?: () => void
  }

  let { config, onRemove }: Props = $props()

  let title = $derived(config.title || 'Embedded app')

  // The standalone app is a hash-routed SPA, so the whole route lives after `#`.
  // `path` is the hash route (e.g. `view` or `lvs-dns/0`); it defaults to `view`.
  let src = $derived.by(() => {
    const base = (config.url || '').trim()
    if (!base) return ''
    const cleanBase = base.endsWith('/') ? base : `${base}/`
    const rawPath = (config.path || 'view').trim()
    const cleanPath = rawPath.startsWith('/') ? rawPath.slice(1) : rawPath
    return `${cleanBase}#${cleanPath}`
  })

  let loaded = $state(false)
  // Reset the loading state whenever the target changes.
  $effect(() => {
    if (src) loaded = false
  })

  function handleSettings() {
    // Settings modal handled by parent
  }
</script>

<WidgetWrapper {title} {onRemove} onSettings={handleSettings}>
  {#if !src}
    <div class="h-full flex flex-col items-center justify-center gap-2 text-theme-text-muted">
      <GlobeIcon size={32} />
      <span class="text-sm">Set the viewer URL in the widget settings</span>
    </div>
  {:else}
    <div class="h-full w-full relative">
      {#if !loaded}
        <div class="absolute inset-0 flex items-center justify-center">
          <SpinnerIcon size={24} class="animate-spin text-theme-text-muted" />
        </div>
      {/if}
      <iframe
        {src}
        {title}
        class="w-full h-full border-0 bg-white dark:bg-black/5"
        loading="lazy"
        allow="fullscreen"
        referrerpolicy="no-referrer-when-downgrade"
        onload={() => (loaded = true)}
      ></iframe>
    </div>
  {/if}
</WidgetWrapper>
