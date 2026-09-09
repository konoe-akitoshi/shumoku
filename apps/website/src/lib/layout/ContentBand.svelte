<script lang="ts">
  import type { Snippet } from 'svelte'

  let { id, title, children }: { id: string; title: string; children: Snippet } = $props()
</script>

<section class="content-band" aria-labelledby={id}>
  <div class="site-container band-grid">
    <h2 {id} class="site-section-title">{title}</h2>
    <div class="band-content">{@render children()}</div>
  </div>
</section>

<style>
  .content-band {
    padding-block: var(--ui-space-8);
  }
  .content-band:nth-of-type(even) {
    background: var(--ui-surface);
  }
  .band-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
    gap: var(--ui-space-8);
  }
  .band-content {
    min-width: 0;
    display: grid;
    gap: var(--ui-space-4);
    align-content: start;
  }
  .band-content :global(p),
  .band-content :global(li) {
    line-height: 1.8;
  }
  .band-content :global(p),
  .band-content :global(ul) {
    color: var(--site-muted);
  }
  .band-content :global(ul) {
    list-style: disc;
    padding-inline-start: 1.25em;
  }
  .band-content :global(a:not(.ui-control)) {
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }
  .band-content :global(.band-links) {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ui-space-4);
    align-items: center;
  }
  @media (max-width: 650px) {
    .band-grid {
      grid-template-columns: 1fr;
      gap: var(--ui-space-4);
    }
  }
</style>
