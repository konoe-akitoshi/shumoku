<script lang="ts">
  import '../website.css'
  import type { Snippet } from 'svelte'
  import { page } from '$app/state'
  import Analytics from '$lib/analytics/Analytics.svelte'
  import SiteFooter from '$lib/layout/SiteFooter.svelte'
  import SiteHeader from '$lib/layout/SiteHeader.svelte'
  import { sitePages } from '$lib/site'
  import type { LayoutData } from './$types'

  let { data, children }: { data: LayoutData; children: Snippet } = $props()
  const path = $derived(page.url.pathname.replace(/^\/(en|ja)/, '').replace(/\/$/, ''))
  const workspace = $derived(
    sitePages.some((entry) => entry.path === path && entry.mode === 'workspace'),
  )
  $effect(() => {
    document.documentElement.lang = data.lang
  })
</script>

<div class="site-shell">
  <Analytics locale={data.lang} />
  <a class="sr-only focus:not-sr-only" href="#main"
    >{data.lang === 'ja' ? '本文へ' : 'Skip to content'}</a
  >
  <SiteHeader locale={data.lang} {path} />
  {@render children()}
  {#if !workspace}
    <SiteFooter locale={data.lang} />
  {/if}
</div>
