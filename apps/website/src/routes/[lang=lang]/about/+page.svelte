<script lang="ts">
  import MarkdownImage from '$lib/blog/MarkdownImage.svelte'
  import OverviewSection from '$lib/home/OverviewSection.svelte'
  import ProjectBackgroundSection from '$lib/home/ProjectBackgroundSection.svelte'
  import ContentBand from '$lib/layout/ContentBand.svelte'
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
  <ContentBand
    id="about-community"
    title={data.lang === 'ja' ? 'コミュニティと育てる' : 'Growing with the community'}
  >
    <MarkdownImage
      src="/images/blog/meetup-1/laptops-1280.webp"
      alt={data.lang === 'ja' ? 'テーブルには参加者のノートPCがずらり。' : 'Attendees’ laptops lined up on the table.'}
      href={`/${data.lang}/blog/meetup-1`}
    />
    <p>
      {data.lang === 'ja' ? '2026年9月8日、最初のShumoku Meetupを開催しました。ネットワーク図の使い方を発表する人、PCを持ち寄る人、会話を楽しむ人。コードだけでなく、使う人どうしが出会う場もつくっています。' : 'We held the first Shumoku Meetup on September 8, 2026. People shared ways to use network diagrams, brought their laptops, and talked with one another. Alongside the code, we are creating a place for the people who use it to meet.'}
    </p>
    <div class="band-links">
      <a href={`/${data.lang}/community`}
        >{data.lang === 'ja' ? 'コミュニティに参加する' : 'Join the community'}</a
      >
      <a href={`/${data.lang}/blog/meetup-1`}
        >{data.lang === 'ja' ? 'Meetup #1を写真で振り返る' : 'Meetup #1 in pictures'}</a
      >
    </div>
  </ContentBand>
</main>
