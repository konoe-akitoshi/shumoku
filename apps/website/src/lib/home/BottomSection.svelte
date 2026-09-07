<script lang="ts">
  import { homeTranslations, type Locale } from '@shumoku/website-content'

  let { locale }: { locale: string } = $props()
  const faq = $derived((homeTranslations[locale as Locale] ?? homeTranslations.en).bottom.faq)
</script>
<section class="site-section">
  <div class="site-container faq-layout">
    <h2 class="site-section-title">{faq.title}</h2>
    <div>
      {#each faq.items as item}
        <details>
          <summary>{item.question}</summary>
          <p>{item.answer}</p>
          {#if 'cta' in item && item.cta}
            <a href={`/${locale}/support`}>{item.cta.label} →</a>
          {/if}
        </details>
      {/each}
    </div>
  </div>
</section>
<style>
  .faq-layout {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 3rem;
  }
  details {
    padding: 1.1rem 0;
    border-bottom: 1px solid var(--site-line);
  }
  details:first-child {
    padding-top: 0;
  }
  summary {
    cursor: pointer;
    font-size: 1rem;
    font-weight: 500;
    line-height: 1.6;
  }
  p {
    margin-top: 0.75rem;
    font-size: 0.9375rem;
    line-height: 1.8;
    color: var(--site-muted);
  }
  a {
    display: inline-block;
    margin-top: 0.75rem;
    text-decoration: underline;
    text-underline-offset: 4px;
    font-size: 0.875rem;
  }
  @media (max-width: 650px) {
    .faq-layout {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }
  }
</style>
