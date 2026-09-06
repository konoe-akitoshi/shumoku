<script lang="ts">
  import '../../website.css'
  import Header from '$lib/home/Header.svelte'
  import Playground from '$lib/playground/Playground.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  $effect(() => {
    document.documentElement.lang = data.lang
  })
</script>

<svelte:head>
  <title>Playground — Shumoku</title>
  <meta
    name="description"
    content="Try Shumoku: edit YAML network diagrams and export SVG, interactive HTML or PNG."
  >
  <link rel="canonical" href={`https://www.shumoku.dev/${data.lang}/playground`}>
  <link rel="alternate" hreflang="en" href="https://www.shumoku.dev/en/playground">
  <link rel="alternate" hreflang="ja" href="https://www.shumoku.dev/ja/playground">
</svelte:head>
<Header locale={data.lang} path="/playground" />
<Playground />
