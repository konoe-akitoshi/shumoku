<script lang="ts">
  import { communityUrl } from '$lib/announcement'
  import PageHeading from '$lib/layout/PageHeading.svelte'
  import PageMeta from '$lib/PageMeta.svelte'
  import { docsUrl } from '$lib/site'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  const ja = $derived(data.lang === 'ja')
  const title = $derived(ja ? 'ブログ' : 'Blog')
  const description = $derived(
    ja
      ? 'Shumokuの開発の背景、新機能、イベント開催記や活用の話。'
      : 'Development stories, new features, event reports and ways people use Shumoku.',
  )
</script>

<PageMeta {title} {description} />
<main id="main">
  <PageHeading {title} {description} />
  <section class="site-container blog-intro" aria-label={ja ? '記事一覧' : 'Articles'}>
    <div class="posts">
      {#each data.posts as post}
        <article lang={post.locale}>
          {#if post.locale !== data.lang}
            <p lang={data.lang}>
              {data.lang === 'en' ? 'Currently available in Japanese only' : '現在は英語のみ'}
            </p>
          {/if}
          {#if post.image}
            <a class="post-image" href={`/${data.lang}${post.path}`} aria-label={post.title}>
              <img src={post.image} alt={post.imageAlt} width="1280" height="720" loading="lazy">
            </a>
          {/if}
          <p>
            <time datetime={post.date}>{post.date.replaceAll('-', '.')}</time>
            {#if post.category}
              · {post.category}
            {/if}
          </p>
          <h2><a href={`/${data.lang}${post.path}`}>{post.title}</a></h2>
          <p>{post.description}</p>
        </article>
      {:else}
        <p>{ja ? '記事を準備しています。' : 'Articles are on the way.'}</p>
      {/each}
    </div>
    <nav aria-label={ja ? '関連する情報' : 'Related information'}>
      <a href={communityUrl}
        >{ja ? '開催予定・参加申込（connpass）' : 'Upcoming events and registration (connpass)'}</a
      >
      <a href={docsUrl(data.lang)}
        >{ja ? '使い方を調べる — Docs' : 'Learn how to use Shumoku — Docs'}</a
      >
    </nav>
  </section>
</main>

<style>
  .posts {
    display: grid;
    gap: var(--ui-space-8);
  }
  article {
    display: grid;
    align-content: start;
    gap: var(--ui-space-4);
  }
  .blog-intro {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    gap: var(--ui-space-6);
    padding-block: var(--ui-space-6) var(--ui-space-8);
  }
  h2 {
    font-size: 1.125rem;
    font-weight: 500;
  }
  .post-image {
    display: block;
    margin-block-end: var(--ui-space-4);
  }
  .post-image img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: var(--ui-panel-radius);
  }
  p {
    margin-block-start: var(--ui-space-2);
    color: var(--site-muted);
    line-height: 1.8;
    max-width: 42rem;
  }
  nav {
    display: flex;
    flex-direction: column;
    align-items: start;
    gap: var(--ui-space-4);
  }
  a {
    text-decoration: underline;
    text-underline-offset: 0.2em;
    line-height: 1.8;
  }
  @media (max-width: 650px) {
    .blog-intro {
      grid-template-columns: 1fr;
    }
  }
</style>
