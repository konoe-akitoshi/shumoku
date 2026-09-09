<script lang="ts">
  import MarkdownImage from '$lib/blog/MarkdownImage.svelte'
  import { findPost } from '$lib/blog/posts'
  import type { Locale } from '$lib/site'

  let { locale }: { locale: Locale } = $props()
  const ja = $derived(locale === 'ja')
  const meetup = $derived(findPost('meetup-1', locale))
</script>

{#if meetup}
  <section class="site-section" aria-labelledby="activity-title">
    <div class="site-container activity-grid">
      <h2 id="activity-title" class="site-section-title">
        {ja ? 'Shumokuの活動' : 'Around Shumoku'}
      </h2>
      <div class="activity-photo">
        <MarkdownImage
          src="/images/blog/meetup-1/toast-1280.webp"
          alt={ja ? '会場のみなさんと乾杯。' : 'A toast together at the venue.'}
          href={`/${locale}${meetup.path}`}
        />
      </div>
      <div class="activity-story">
        <p class="event-label">{ja ? 'イベント開催記' : 'Event report'} · 2026.09.08</p>
        <h3 lang={meetup.locale}><a href={`/${locale}${meetup.path}`}>{meetup.title}</a></h3>
        <p class="site-section-subtitle" lang={meetup.locale}>{meetup.description}</p>
        <h3>
          <a href={`/${locale}/community`}
            >{ja ? 'コミュニティに参加する' : 'Join the community'}</a
          >
        </h3>
        <p class="site-section-subtitle">
          {ja ? '質問、イベント、開発への貢献。使う人もつくる人も、ここから。' : 'Questions, events and contributions. Find your way in as a user or a contributor.'}
        </p>
      </div>
    </div>
  </section>
{/if}

<style>
  .activity-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--ui-space-8);
  }
  .activity-grid > h2 {
    grid-column: 1 / -1;
  }
  .activity-photo {
    grid-column: span 2;
  }
  .activity-story {
    display: grid;
    align-content: start;
    gap: var(--ui-space-4);
  }
  .event-label {
    color: var(--site-muted);
    font-size: 0.875rem;
  }
  h3 {
    font-size: 1.125rem;
    font-weight: 500;
  }
  a {
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }
  @media (max-width: 650px) {
    .activity-grid {
      grid-template-columns: 1fr;
    }
    .activity-photo {
      grid-column: auto;
    }
  }
</style>
