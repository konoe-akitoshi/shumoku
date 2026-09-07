<script lang="ts">
  import AnalyticsSettings from '$lib/analytics/AnalyticsSettings.svelte'
  import { docsUrl, editorOrigin, type Locale } from '$lib/site'

  let { locale }: { locale: Locale } = $props()
  const columns = $derived([
    {
      title: locale === 'ja' ? '使う' : 'Use Shumoku',
      links: [
        { label: 'Docs', href: docsUrl(locale) },
        { label: 'Playground', href: `/${locale}/playground` },
        { label: 'Editor', href: editorOrigin },
      ],
    },
    {
      title: locale === 'ja' ? 'プロジェクト' : 'Project',
      links: [
        { label: locale === 'ja' ? 'Shumokuについて' : 'About', href: `/${locale}/about` },
        { label: 'GitHub', href: 'https://github.com/konoe-akitoshi/shumoku' },
        { label: 'X', href: 'https://x.com/shumoku_dev' },
      ],
    },
    {
      title: locale === 'ja' ? 'サポート' : 'Support',
      links: [
        {
          label: locale === 'ja' ? '商用サポート' : 'Commercial support',
          href: `/${locale}/support`,
        },
        { label: locale === 'ja' ? 'お問い合わせ' : 'Contact', href: 'mailto:contact@shumoku.dev' },
      ],
    },
  ])
</script>

<footer class="site-footer">
  <div class="site-container footer-grid">
    <div>
      <a href={`/${locale}`} class="footer-name">Shumoku</a>
      <p>AGPL-3.0 · Open source</p>
      <div class="privacy-links">
        <a href={`/${locale}/privacy`}>{locale === 'ja' ? 'プライバシー' : 'Privacy'}</a>
        <AnalyticsSettings {locale} />
      </div>
    </div>
    {#each columns as column}
      <nav aria-label={column.title}>
        <h2>{column.title}</h2>
        {#each column.links as link}
          <a href={link.href}>{link.label}</a>
        {/each}
      </nav>
    {/each}
  </div>
</footer>
<style>
  .site-footer {
    border-top: 1px solid var(--site-line);
    padding: 3rem 0;
    margin-top: auto;
  }
  .footer-grid {
    display: grid;
    grid-template-columns: 2fr repeat(3, 1fr);
    gap: 2rem;
  }
  .footer-name {
    font-size: 1.25rem;
    font-weight: 600;
  }
  .privacy-links {
    display: flex;
    flex-direction: column;
    align-items: start;
    margin-top: 1rem;
    font-size: 0.8125rem;
    color: var(--site-muted);
  }
  p {
    color: var(--site-muted);
    font-size: 0.8125rem;
    margin-top: 0.75rem;
  }
  nav {
    display: flex;
    flex-direction: column;
    align-items: start;
    gap: 0.7rem;
    font-size: 0.875rem;
  }
  h2 {
    font-size: 0.875rem;
    font-weight: 600;
    margin-bottom: 0.35rem;
  }
  nav a {
    color: var(--site-muted);
  }
  a:hover {
    text-decoration: underline;
    text-underline-offset: 4px;
  }
  @media (max-width: 650px) {
    .footer-grid {
      grid-template-columns: 1fr 1fr;
      row-gap: 2.5rem;
    }
  }
</style>
