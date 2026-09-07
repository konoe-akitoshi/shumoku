<script lang="ts">
  import OverviewSection from '$lib/home/OverviewSection.svelte'
  import ProjectBackgroundSection from '$lib/home/ProjectBackgroundSection.svelte'
  import PageHeading from '$lib/layout/PageHeading.svelte'
  import PageMeta from '$lib/PageMeta.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  const title = $derived(data.lang === 'ja' ? 'Shumokuについて' : 'About Shumoku')
  const description = $derived(
    data.lang === 'ja'
      ? 'プロジェクトの目的、名前とロゴの由来、設計の考え方。'
      : 'The project, its name and logo, and the ideas behind its design.',
  )
</script>
<PageMeta {title} {description} />
<main id="main">
  <PageHeading {title} {description} /><OverviewSection locale={data.lang} />
  <ProjectBackgroundSection locale={data.lang} />
</main>
