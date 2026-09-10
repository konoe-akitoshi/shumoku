<script lang="ts">
  import CommercialSupportSection from '$lib/home/CommercialSupportSection.svelte'
  import ForTeamsSection from '$lib/home/ForTeamsSection.svelte'
  import ContentBand from '$lib/layout/ContentBand.svelte'
  import PageHeading from '$lib/layout/PageHeading.svelte'
  import PageMeta from '$lib/PageMeta.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  const ja = $derived(data.lang === 'ja')
  const repo = 'https://github.com/konoe-akitoshi/shumoku'
  const title = $derived(ja ? '導入・商用サポート' : 'Shumoku for teams')
  const description = $derived(
    data.lang === 'ja'
      ? 'オープンソースのShumokuを、あなたの現場へ。評価・導入からデータ連携、運用まで、必要な作業を一緒に進めます。'
      : 'Bring open-source Shumoku into your operations. Work with us on evaluation, deployment, integrations and ongoing support.',
  )
</script>
<PageMeta {title} {description} />
<main id="main">
  <PageHeading {title} {description} />
  <CommercialSupportSection locale={data.lang} />
  <ForTeamsSection locale={data.lang} />
  <ContentBand
    id="support-community"
    title={ja ? '公開の場で相談したい方へ' : 'Looking for community help?'}
  >
    <p>
      {ja ? '一般的な質問、再現可能なバグ報告、機能の提案はコミュニティへ。個人・企業を問わず参加できます。非公開の情報を扱う調査や期限付きの作業は、商用窓口でご相談ください。' : 'General questions, reproducible bug reports and feature ideas belong in the community, whether you are an individual or an organization. For private investigations or deadline-bound work, contact us commercially.'}
    </p>
    <div class="band-links">
      <a href={`/${data.lang}/community`}
        >{ja ? 'コミュニティの窓口を見る' : 'Find community channels'}</a
      ><a href={`${repo}/blob/main/SUPPORT.md`}>{ja ? 'サポート方針' : 'Support policy'}</a>
    </div>
  </ContentBand>
</main>
