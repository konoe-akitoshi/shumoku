<script lang="ts">
  import CommercialSupportSection from '$lib/home/CommercialSupportSection.svelte'
  import ForTeamsSection from '$lib/home/ForTeamsSection.svelte'
  import PageHeading from '$lib/layout/PageHeading.svelte'
  import PageMeta from '$lib/PageMeta.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  const title = $derived(data.lang === 'ja' ? 'サポート' : 'Support')
  const description = $derived(
    data.lang === 'ja'
      ? 'コミュニティでの相談と、導入・運用・開発の商用支援。'
      : 'Community help and commercial assistance with deployment, operations and development.',
  )
</script>
<PageMeta {title} {description} />
<main id="main">
  <PageHeading {title} {description} /><CommercialSupportSection locale={data.lang} />
  <ForTeamsSection locale={data.lang} />
</main>
