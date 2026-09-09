<script lang="ts">
  import { communityUrl } from '$lib/announcement'
  import CommunityMontage from '$lib/community/CommunityMontage.svelte'
  import { photoUrl } from '$lib/community/photos'
  import ContentBand from '$lib/layout/ContentBand.svelte'
  import PageHeading from '$lib/layout/PageHeading.svelte'
  import PageMeta from '$lib/PageMeta.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  const ja = $derived(data.lang === 'ja')
  const title = $derived(ja ? 'コミュニティ' : 'Community')
  const description = $derived(
    ja
      ? '使う人も、つくる人も。質問、実例、アイデアを持ち寄り、Shumokuを一緒に育てる場所。'
      : 'For users and contributors alike. Share questions, examples and ideas to help shape Shumoku.',
  )
  const repo = 'https://github.com/konoe-akitoshi/shumoku'
</script>
<PageMeta {title} {description} image={photoUrl('group')} />
<main id="main">
  <div class="site-container community-montage"><CommunityMontage locale={data.lang} /></div>
  <PageHeading {title} {description} />
  <section class="site-container community-intro" aria-labelledby="community-people">
    <h2 id="community-people">
      {ja ? '使う人と、つくる人が出会う場所。' : 'Where users and builders meet.'}
    </h2>
    <div class="community-story">
      <p>
        {ja ? '最初のMeetupでは、Shumokuやネットワーク図の話題を持ち寄りました。登壇だけでなく、同じテーブルでPCを開いたり、会話を交わしたり。写真から、その雰囲気をのぞいてみてください。' : 'Our first meetup brought people together around Shumoku and network diagrams. Beyond the talks, there were open laptops and conversations around the same table. Take a look at the day in pictures.'}
      </p>
    </div>
  </section>
  <ContentBand id="community-talk" title={ja ? '質問する・話す' : 'Ask and share'}>
    <p>
      {ja ? '使い方の質問やアイデアの交換はGitHub Discussions・Discordへ。コミュニティの回答はベストエフォートです。内部ホスト名や顧客情報などは、公開前に匿名化してください。' : 'Ask usage questions and exchange ideas on GitHub Discussions or Discord. Community help is best effort. Anonymize internal hostnames and customer information before sharing.'}
    </p>
    <div class="band-links">
      <a href={`${repo}/discussions`}>GitHub Discussions</a
      ><a href="https://discord.gg/dyYbEsDZYr">Discord</a>
    </div>
  </ContentBand>
  <ContentBand id="community-events" title={ja ? 'イベントで会う' : 'Meet the community'}>
    <p>
      {ja ? 'まずは開催記で雰囲気を知るところから。次のイベントの日程や参加方法はconnpassで確認できます。' : 'Start with the report to get a feel for the meetup. Find dates and registration details for upcoming events on connpass.'}
    </p>
    <div class="band-links">
      <a href={communityUrl}>{ja ? '開催予定・参加申込' : 'Events and registration'}</a
      ><a href={`/${data.lang}/blog/meetup-1`}>{ja ? 'Meetup #1の開催記' : 'Meetup #1 report'}</a>
    </div>
  </ContentBand>
  <ContentBand id="community-contribute" title={ja ? '開発に参加する' : 'Contribute'}>
    <p>
      {ja ? 'バグ報告、機能の提案、ドキュメントの改善も大切な貢献です。大きな変更は、実装前にIssueやDiscussionで相談してください。' : 'Bug reports, feature ideas and documentation improvements all count. Discuss substantial changes before implementing them.'}
    </p>
    <div class="band-links">
      <a href={`${repo}/issues`}>GitHub Issues</a
      ><a href={`${repo}/blob/main/CONTRIBUTING.md`}>{ja ? '貢献ガイド' : 'Contribution guide'}</a
      ><a href={`${repo}/blob/main/CODE_OF_CONDUCT.md`}>{ja ? '行動規範' : 'Code of conduct'}</a
      ><a href={`${repo}/blob/main/GOVERNANCE.md`}>{ja ? '運営方針' : 'Governance'}</a>
    </div>
    <p>
      {ja ? '脆弱性は公開Issueに投稿せず、非公開の報告窓口をご利用ください。' : 'Do not report vulnerabilities in public issues. Use the private reporting channels.'}
      <a href={`${repo}/blob/main/SECURITY.md`}
        >{ja ? 'セキュリティポリシー' : 'Security policy'}</a
      >
    </p>
  </ContentBand>
  <ContentBand id="community-business" title={ja ? '個別の環境を相談する' : 'Need hands-on help?'}>
    <p>
      {ja ? '企業の方もコミュニティに参加できます。非公開の構成を扱う調査や導入・連携開発など、個別の作業が必要な場合は商用サポートへ。' : 'Organizations are welcome in the community too. For private investigations, deployment or integration work in your environment, explore commercial support.'}
    </p>
    <div class="band-links">
      <a href={`/${data.lang}/support`}
        >{ja ? '導入・商用サポートを相談する' : 'Explore commercial support'}</a
      ><a href={`/${data.lang}/about`}>{ja ? 'Shumokuについて' : 'About Shumoku'}</a>
    </div>
  </ContentBand>
</main>

<style>
  .community-montage {
    padding-block-start: var(--ui-space-8);
  }
  .community-intro {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
    gap: var(--ui-space-8);
    padding-block-end: var(--ui-space-8);
    align-items: start;
  }
  .community-story {
    display: grid;
    gap: var(--ui-space-4);
  }
  h2 {
    font-size: 1.5rem;
    line-height: 2rem;
    font-weight: 500;
    text-wrap: balance;
  }
  p {
    line-height: 1.8;
  }
  a {
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }
  @media (max-width: 650px) {
    .community-intro {
      grid-template-columns: 1fr;
      gap: var(--ui-space-4);
    }
  }
</style>
