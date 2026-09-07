<script lang="ts">
  import { onMount } from 'svelte'
  import { isWebsiteHost } from './policy'

  let { locale }: { locale: 'en' | 'ja' } = $props()
  let client = $state<typeof import('./client')>()

  onMount(() => {
    if (!isWebsiteHost(new URL(location.href), import.meta.env.PROD)) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let idle: number | undefined
    const start = async () => {
      try {
        const module = await import('./client')
        if (cancelled) return
        client = module
        await module.initializeAnalytics()
      } catch {
        // Optional analytics must never interrupt the website.
      }
    }
    const schedule = () => {
      if ('requestIdleCallback' in window) {
        idle = window.requestIdleCallback(
          () => {
            void start()
          },
          { timeout: 2000 },
        )
      } else {
        timer = setTimeout(() => {
          void start()
        }, 500)
      }
    }
    if (document.readyState === 'complete') schedule()
    else window.addEventListener('load', schedule, { once: true })
    return () => {
      cancelled = true
      window.removeEventListener('load', schedule)
      if (idle !== undefined) window.cancelIdleCallback(idle)
      if (timer !== undefined) clearTimeout(timer)
    }
  })
  $effect(() => {
    void client?.setAnalyticsLanguage(locale).catch(() => {})
  })
</script>
