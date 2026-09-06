<script lang="ts">
  import { homeTranslations } from '@shumoku/website-content'
  import Section from '$lib/Section.svelte'
  import '../website.css'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  const lang = $derived(data.lang)
  $effect(() => {
    document.documentElement.lang = lang
  })
  const t = $derived(homeTranslations[lang])
  const docs = (section = '') => `https://docs.shumoku.dev/${lang}${section ? `/${section}` : ''}`
  const productLink = (href: string) => (href.startsWith('/docs/') ? docs(href.slice(6)) : href)
</script>

<svelte:head>
  <title>Shumoku — {t.hero.title1} {t.hero.title2}</title>
  <meta name="description" content={`${t.hero.description1} ${t.hero.description2}`}>
  <link rel="canonical" href={`https://www.shumoku.dev/${lang}`}>
  <link rel="alternate" hreflang="en" href="https://www.shumoku.dev/en">
  <link rel="alternate" hreflang="ja" href="https://www.shumoku.dev/ja">
  <meta property="og:title" content={`Shumoku — ${t.hero.title1} ${t.hero.title2}`}>
  <meta property="og:description" content={`${t.hero.description1} ${t.hero.description2}`}>
  <meta property="og:image" content="https://www.shumoku.dev/screenshots/topology.png">
</svelte:head>

<a class="skip" href="#main">{lang === 'ja' ? '本文へ' : 'Skip to content'}</a>
<header>
  <a class="brand" href={`/${lang}`}
    ><img src="/logo-horizontal.svg" alt="Shumoku" width="148" height="32"></a
  >
  <nav aria-label={lang === 'ja' ? 'メインナビゲーション' : 'Main navigation'}>
    <a href="#platform">{lang === 'ja' ? '製品' : 'Products'}</a><a href={docs()}>Docs ↗</a>
    <a href="https://editor.shumoku.dev/">Editor ↗</a>
    <a href={lang === 'ja' ? '/en' : '/ja'} lang={lang === 'ja' ? 'en' : 'ja'}
      >{lang === 'ja' ? 'English' : '日本語'}</a
    >
  </nav>
</header>
<main id="main">
  <section class="hero">
    <div class="hero-copy">
      <p class="eyebrow">{t.hero.label}</p>
      <h1>{t.hero.title1}<br><span>{t.hero.title2}</span></h1>
      <p class="lead">{t.hero.description1}<br>{t.hero.description2}</p>
      <div class="actions">
        <a class="button primary" href={docs('server')}>{t.hero.deploy} →</a
        ><a class="button" href="https://demo.shumoku.dev/share/topologies/R71ZG1gEigiVY82YKpgDT03I"
          >{t.hero.liveDemo}
          ↗</a
        >
      </div>
      <p class="small">
        <a href="https://github.com/konoe-akitoshi/shumoku">GitHub ↗</a>
        · <a href="mailto:contact@shumoku.dev">{t.hero.demo}</a>
      </p>
    </div>
    <figure class="hero-image">
      <img src="/screenshots/topology.png" alt={t.gallery.items[0].alt} fetchpriority="high">
    </figure>
  </section>
  <Section id="platform" title={t.platform.title} description={t.platform.description}>
    <div class="grid products">
      {#each t.platform.layers as item}
        <article>
          <h3>{item.title}</h3>
          <p>{item.description}</p>
          {#if item.href}
            <a href={productLink(item.href)}>{item.cta} →</a>
          {/if}
        </article>
      {/each}
    </div>
    <a class="text-link" href={docs('about/philosophy')}>{t.platform.philosophyCta} →</a>
  </Section>
  <Section
    id="integrations"
    title={t.integrations.title}
    description={t.integrations.centerDescription}
  >
    <div class="integration-groups">
      {#each [{label:t.integrations.inputLabel,items:t.integrations.inputs},{label:t.integrations.monitoringLabel,items:t.integrations.monitoring}] as group}
        <div>
          <h3>{group.label}</h3>
          <div class="grid">
            {#each group.items as item}
              <article>
                <h4>{item.title}</h4>
                <p>{item.description}</p>
              </article>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </Section>
  <Section id="features" title={t.features.title}
    ><div class="grid">
      {#each t.features.items as item}
        <article>
          <h3>{item.title}</h3>
          <p>{item.description}</p>
        </article>
      {/each}
    </div></Section
  >
  <Section id="gallery" title={t.gallery.title}
    ><div class="gallery">
      {#each t.gallery.items as item}
        <figure>
          <img src={item.src} alt={item.alt} loading="lazy">
          <figcaption>{item.caption}</figcaption>
        </figure>
      {/each}
    </div></Section
  >
  <Section id="start" title={t.gettingStarted.title}
    ><div class="grid two">
      <article>
        <h3>{t.gettingStarted.community.label}</h3>
        <ol>
          {#each t.gettingStarted.community.steps as step}
            <li>{step}</li>
          {/each}
        </ol>
        <a class="button primary" href={docs('server')}>{t.gettingStarted.community.cta} →</a>
      </article>
      <article id="enterprise">
        <h3>{t.gettingStarted.production.label}</h3>
        <ul>
          {#each t.gettingStarted.production.items as item}
            <li>{item}</li>
          {/each}
        </ul>
        <a class="button" href="mailto:contact@shumoku.dev">{t.gettingStarted.production.cta} →</a>
      </article>
    </div></Section
  >
  <Section id="teams" title={t.forTeams.title} description={t.forTeams.description}
    ><div class="grid products">
      {#each t.forTeams.nodes as item}
        <article>
          <h3>{item.title}</h3>
          <p>{item.description}</p>
        </article>
      {/each}
    </div>
    <p class="small">{t.forTeams.supportNote}</p>
    <a href={docs('community/commercial-support')}>{t.forTeams.supportCta} →</a></Section
  >
  <Section id="faq" title={t.bottom.faq.title}
    ><div class="faq">
      {#each t.bottom.faq.items as item}
        <details>
          <summary>{item.question}</summary>
          <p>{item.answer}</p>
          {#if 'cta' in item && item.cta}
            <a href={item.cta.href}>{item.cta.label} →</a>
          {/if}
        </details>
      {/each}
    </div></Section
  >
  <section class="closing">
    <h2>{t.bottom.cta.title}</h2>
    <a class="button primary" href={docs('server')}>{t.bottom.cta.deploy} →</a>
  </section>
</main>
<footer>
  <span>Shumoku · AGPL-3.0-only</span>
  <nav aria-label="Community">
    {#each t.bottom.community.items as item}
      <a href={item.url}>{item.name}</a>
    {/each}
    <a href={docs('project/security')}>{lang === 'ja' ? 'セキュリティ' : 'Security'}</a>
  </nav>
</footer>
