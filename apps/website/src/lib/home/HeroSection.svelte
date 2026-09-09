<script lang="ts">
  import { homeTranslations, type Locale } from '@shumoku/website-content'
  import LinkButton from '$lib/ui/LinkButton.svelte'
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
      <LinkButton href={docsUrl(locale, 'server')} variant="primary">{t.deploy}</LinkButton>
      <LinkButton href={`/${locale}/playground`}>Playground</LinkButton>
      <a
        class="text-link"
        href="https://demo.shumoku.dev/share/topologies/R71ZG1gEigiVY82YKpgDT03I"
        target="_blank"
        rel="noopener noreferrer"
        >{t.liveDemo}
        ↗</a
      >
    </div>
    <a class="scroll-link" href="#website-features">
      {locale === 'ja' ? '機能を見る' : 'Explore the features'} <span aria-hidden="true">↓</span>
    </a>
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
    display: grid;
    grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
    align-items: center;
    gap: 3rem;
    padding-block: 3rem 1.5rem;
  }
  .hero-copy {
    min-width: 0;
  }
  h1 {
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
    margin-top: 1.5rem;
  }
  .hero-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }
  .scroll-link {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 1.5rem;
    padding-block: 0.5rem;
    font-size: 0.875rem;
    color: var(--site-muted);
    text-underline-offset: 4px;
  }
  .scroll-link:hover {
    color: var(--site-fg);
    text-decoration: underline;
  }
  .text-link {
    font-size: 0.875rem;
    text-decoration: underline;
    text-underline-offset: 4px;
    padding: 0.5rem 0;
  }
  figure {
    margin: 0;
    min-width: 0;
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
  @media (max-width: 850px) {
    .hero {
      grid-template-columns: 1fr;
      gap: 2rem;
      padding-top: 2.5rem;
    }
    h1 {
      font-size: clamp(2.5rem, 6vw, 3.5rem);
    }
  }
</style>
