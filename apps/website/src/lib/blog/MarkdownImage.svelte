<script lang="ts">
  import { page } from '$app/state'
  import { articleAsset } from './assets'

  let {
    src,
    alt = '',
    title,
    href,
  }: { src: string; alt?: string; title?: string; href?: string } = $props()
  const imageUrl = $derived(articleAsset(page.params.slug ?? '', src))
</script>

<span class="article-photo">
  <a href={href ?? imageUrl} aria-label={alt || title}>
    <img src={imageUrl} alt={alt || ''} {title} loading="lazy" decoding="async">
  </a>
  {#if alt}
    <span class="caption">{alt}</span>
  {/if}
</span>

<style>
  .article-photo {
    display: block;
    min-width: 0;
  }
  a {
    display: block;
    overflow: hidden;
    border-radius: var(--ui-panel-radius);
  }
  a:focus-visible {
    outline: 2px solid var(--site-accent);
    outline-offset: var(--ui-space-1);
  }
  img {
    display: block;
    width: 100%;
    height: auto;
  }
  .caption {
    display: block;
    margin-block-start: var(--ui-space-2);
    color: var(--site-muted);
    font-size: 0.875rem;
    line-height: 1.5rem;
  }
</style>
