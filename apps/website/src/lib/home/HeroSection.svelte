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
    <p class="hero-position">
      {locale === 'ja' ? 'オープンソースの自由を、ネットワーク運用に。' : 'Open-source freedom for network operations.'}
    </p>
    <div class="hero-actions">
      <LinkButton href={docsUrl(locale, 'server')} variant="primary" class="deploy-link">
        {t.deploy}
        <img class="deploy-icon" src="/server-deploy.svg" alt="" aria-hidden="true">
      </LinkButton>
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
    <p class="hero-business">
      {locale === 'ja' ? '自分で導入。必要なときは、導入支援や連携開発を相談できます。' : 'Deploy it yourself, or work with us on deployment and integrations.'}
      <a href={`/${locale}/support`}>{locale === 'ja' ? '導入相談' : 'Talk to us'}</a>
    </p>
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
    position: relative;
    isolation: isolate;
    display: grid;
    grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
    align-items: center;
    gap: 3rem;
    padding-block: 3rem 1.5rem;
  }
  .hero::before {
    position: absolute;
    z-index: -1;
    inset: var(--ui-space-4) 0;
    content: "";
    pointer-events: none;
    opacity: 0.3;
    background-image:
      radial-gradient(circle, var(--brand-green-500) 1.5px, transparent 2px),
      radial-gradient(circle, var(--brand-lime-500) 1.5px, transparent 2px);
    background-position:
      0 0,
      1.5rem 1.125rem;
    background-size:
      3rem 3rem,
      4.5rem 4.5rem;
    mask-image: linear-gradient(90deg, transparent 15%, #000 58%, #000 100%);
    animation: hero-particles 36s linear infinite;
  }
  .hero-copy {
    min-width: 0;
  }
  h1 {
    font-size: clamp(3rem, 5.4vw, 4.5rem);
    line-height: 1.1;
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
  .hero-position {
    margin-block: var(--ui-space-4) 0;
    font-size: 0.875rem;
    color: var(--site-fg);
  }
  .hero-business {
    margin-top: var(--ui-space-4);
    font-size: 0.875rem;
  }
  .hero-business a {
    color: var(--site-fg);
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }
  :global(.deploy-link) {
    gap: var(--ui-space-2);
  }
  .deploy-icon {
    display: block;
    inline-size: auto;
    block-size: 1.25rem;
    filter: drop-shadow(1px 0 0 var(--ui-on-primary)) drop-shadow(-1px 0 0 var(--ui-on-primary))
      drop-shadow(0 1px 0 var(--ui-on-primary)) drop-shadow(0 -1px 0 var(--ui-on-primary));
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
  figure > img {
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
      font-size: clamp(3rem, 8vw, 3.75rem);
    }
    .hero::before {
      opacity: 0.22;
      mask-image: linear-gradient(180deg, transparent 5%, #000 48%, transparent 100%);
    }
  }
  @keyframes hero-particles {
    to {
      background-position:
        3rem 1.5rem,
        -3rem 3.375rem;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .hero::before {
      animation: none;
    }
  }
</style>
