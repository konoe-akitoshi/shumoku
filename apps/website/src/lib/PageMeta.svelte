<script lang="ts">
  import { page } from '$app/state'
  import { websiteOrigin } from './site'

  let { title, description }: { title: string; description: string } = $props()
  const suffix = $derived(page.url.pathname.replace(/^\/(en|ja)/, ''))
</script>
<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description}>
  <link rel="canonical" href={`${websiteOrigin}${page.url.pathname}`}>
  <link rel="alternate" hreflang="en" href={`${websiteOrigin}/en${suffix}`}>
  <link rel="alternate" hreflang="ja" href={`${websiteOrigin}/ja${suffix}`}>
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Shumoku">
  <meta property="og:title" content={title}>
  <meta property="og:description" content={description}>
  <meta property="og:url" content={`${websiteOrigin}${page.url.pathname}`}>
  <meta property="og:image" content={`${websiteOrigin}/screenshots/topology.png`}>
  <meta name="twitter:card" content="summary_large_image">
</svelte:head>
