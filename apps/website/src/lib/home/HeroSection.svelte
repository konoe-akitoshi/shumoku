<script lang="ts">
  import { homeTranslations, type Locale } from '@shumoku/website-content'
  import { docsUrl } from './styles'

  let { locale }: { locale: string } = $props()
  const t = $derived(homeTranslations[locale as Locale]?.hero ?? homeTranslations.en.hero)
</script>
<section class="hero site-container">
  <div class="hero-copy">
    <h1>{t.title1}<br>{t.title2}</h1>
    <p>
      {locale === 'ja' ? 'YAMLや実際のインフラデータから、ネットワーク構成図を生成。ドキュメントへの埋め込みから、日々の運用・監視まで。' : 'Generate network diagrams from YAML and real infrastructure data. Embed them in documentation or use them for daily operations and monitoring.'}
    </p>
    <div class="hero-actions">
      <a href={docsUrl(locale, 'server')} class="site-button site-button-primary">{t.deploy}</a>
      <a href={`/${locale}/playground`} class="site-button site-button-secondary">Playground</a>
      <a
        class="text-link"
        href="https://demo.shumoku.dev/share/topologies/R71ZG1gEigiVY82YKpgDT03I"
        target="_blank"
        rel="noopener noreferrer"
        >{t.liveDemo}
        ↗</a
      >
    </div>
  </div>
  <figure>
    <img
      src="/screenshots/topology.png"
      alt="Topology viewer with live weathermap"
      width="3840"
      height="2160"
      fetchpriority="high"
    >
    <figcaption>
      {locale === 'ja' ? 'Shumoku Server — トポロジーとライブトラフィック' : 'Shumoku Server — topology and live traffic'}
    </figcaption>
  </figure>
</section>
<style>
  .hero {
    padding-block: 4.5rem 2rem;
  }
  .hero-copy {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem 4rem;
    align-items: start;
    margin-bottom: 2.75rem;
  }
  h1 {
    grid-row: span 2;
    font-size: clamp(2.5rem, 4.7vw, 3.8rem);
    line-height: 1.17;
    letter-spacing: -0.04em;
    font-weight: 600;
  }
  p {
    max-width: 34rem;
    font-size: 1.0625rem;
    line-height: 1.85;
    color: var(--site-muted);
    padding-top: 0.25rem;
  }
  .hero-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }
  .text-link {
    font-size: 0.875rem;
    text-decoration: underline;
    text-underline-offset: 4px;
    padding: 0.5rem 0;
  }
  figure {
    margin: 0;
  }
  img {
    display: block;
    width: 100%;
    height: auto;
    border: 1px solid var(--site-line);
    border-radius: 6px;
  }
  figcaption {
    margin-top: 0.75rem;
    font-size: 0.8125rem;
    color: var(--site-muted);
  }
  @media (max-width: 750px) {
    .hero {
      padding-top: 2.75rem;
    }
    .hero-copy {
      grid-template-columns: 1fr;
      gap: 1.25rem;
      margin-bottom: 2rem;
    }
    h1 {
      grid-row: auto;
    }
  }
</style>
