<script lang="ts">
  import { page } from '$app/state'
  import { type Locale, websiteOrigin } from './site'

  let {
    title,
    description,
    image = '/screenshots/topology.png',
    type = 'website',
    alternateLocales = ['en', 'ja'],
    canonicalPath,
  }: {
    title: string
    description: string
    image?: string
    type?: 'website' | 'article'
    alternateLocales?: Locale[]
    canonicalPath?: string
  } = $props()
  const suffix = $derived(page.url.pathname.replace(/^\/(en|ja)/, ''))
</script>
<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description}>
  <link rel="canonical" href={`${websiteOrigin}${canonicalPath ?? page.url.pathname}`}>
  {#each alternateLocales as locale}
    <link rel="alternate" hreflang={locale} href={`${websiteOrigin}/${locale}${suffix}`}>
  {/each}
  <meta property="og:type" content={type}>
  <meta property="og:site_name" content="Shumoku">
  <meta property="og:title" content={title}>
  <meta property="og:description" content={description}>
  <meta property="og:url" content={`${websiteOrigin}${canonicalPath ?? page.url.pathname}`}>
  <meta property="og:image" content={`${websiteOrigin}${image}`}>
  <meta name="twitter:card" content="summary_large_image">
</svelte:head>
