<script lang="ts">
  import PageMeta from '$lib/PageMeta.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  const post = $derived(data.post)
  const Content = $derived(data.Content)
</script>

<PageMeta
  title={post.title}
  description={post.description}
  image={post.image}
  type="article"
  alternateLocales={[post.locale]}
  canonicalPath={`/${post.locale}${post.path}`}
/>
<main id="main" class="site-container report">
  {#if data.fallback}
    <p class="language-note" lang={data.lang}>
      {data.lang === 'en'
        ? 'This article is currently available in Japanese only. The original text is shown below.'
        : 'この記事の日本語版はまだありません。英語の原文を表示しています。'}
    </p>
  {/if}
  <article lang={post.locale}>
    <header class="report-heading">
      <a href={`/${data.lang}/blog`} lang={data.lang}
        >{data.lang === 'ja' ? 'ブログに戻る' : 'Back to the blog'}</a
      >
      <p class="eyebrow">
        {#if post.category}
          {post.category}
          ·
        {/if}
        <time datetime={post.date}>{post.date.replaceAll('-', '.')}</time>
      </p>
      <h1>{post.title}</h1>
      <p class="intro">{post.description}</p>
    </header>
    {#if post.image}
      <figure class="cover">
        <a href={post.image}><img src={post.image} alt={post.imageAlt} fetchpriority="high"></a>
        <figcaption>{post.imageAlt}</figcaption>
      </figure>
    {/if}
    <div class="article-body"><Content /></div>
  </article>
</main>

<style>
  .language-note {
    margin-block-end: var(--ui-space-6);
    padding: var(--ui-space-4);
    background: var(--ui-surface);
    line-height: 1.8;
  }
  .report {
    padding-block: var(--ui-space-8);
  }
  article,
  .report-heading {
    display: grid;
    gap: var(--ui-space-8);
  }
  .report-heading {
    gap: var(--ui-space-4);
  }
  .eyebrow,
  figcaption {
    color: var(--site-muted);
    font-size: 0.875rem;
  }
  h1 {
    font-size: clamp(1.75rem, 3vw, 3rem);
    line-height: 1.4;
    font-weight: 600;
    text-wrap: balance;
  }
  .intro {
    max-width: 44rem;
    line-height: 1.8;
  }
  figure {
    margin: 0;
  }
  a,
  .article-body :global(a) {
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }
  .cover a {
    display: block;
    border-radius: var(--ui-panel-radius);
    overflow: hidden;
  }
  .cover img {
    display: block;
    width: 100%;
    aspect-ratio: 2 / 1;
    object-fit: cover;
    object-position: center bottom;
  }
  figcaption {
    margin-block-start: var(--ui-space-2);
    line-height: 1.5rem;
  }
  .article-body {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    gap: var(--ui-space-4) var(--ui-space-6);
    line-height: 1.8;
    overflow-wrap: anywhere;
    min-width: 0;
  }
  .article-body > :global(*) {
    grid-column: 5 / -1;
  }
  .article-body > :global(h2) {
    grid-column: 1 / 5;
  }
  .article-body :global(p:has(> .article-photo)) {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--ui-space-6);
    max-width: none;
  }
  .article-body :global(p:has(> .article-photo:nth-of-type(3))) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .article-body :global(p:has(> .article-photo:only-child)) {
    grid-template-columns: 1fr;
  }
  .article-body :global(p:has(> .article-photo:nth-of-type(2)) img) {
    aspect-ratio: 4 / 3;
    object-fit: cover;
  }
  .article-body > :global(*) {
    margin-block: 0 var(--ui-space-6);
  }
  .article-body :global(h2) {
    font-size: 1.25rem;
    line-height: 2rem;
    font-weight: 500;
  }
  .article-body :global(h3) {
    font-size: 1.125rem;
    font-weight: 500;
  }
  .article-body :global(p),
  .article-body :global(ul),
  .article-body :global(ol) {
    max-width: 44rem;
  }
  .article-body :global(ul) {
    list-style: disc;
    padding-inline-start: 1.5em;
  }
  .article-body :global(ol) {
    list-style: decimal;
    padding-inline-start: 1.5em;
  }
  .article-body :global(blockquote) {
    padding: var(--ui-space-4);
    background: var(--ui-surface);
  }
  .article-body :global(pre) {
    padding: var(--ui-space-4);
    overflow: auto;
    border-radius: var(--ui-panel-radius);
  }
  .article-body :global(img) {
    max-width: 100%;
  }
  @media (max-width: 650px) {
    .article-body > :global(*),
    .article-body > :global(h2) {
      grid-column: 1 / -1;
    }
    .article-body :global(p:has(> .article-photo)),
    .article-body :global(p:has(> .article-photo:nth-of-type(3))) {
      grid-template-columns: 1fr;
    }
  }
</style>
