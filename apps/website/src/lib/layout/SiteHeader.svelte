<script lang="ts">
  import { Languages, Menu, Moon, Sun } from '@lucide/svelte'
  import { rememberLanguage } from '@shumoku/site-i18n'
  import { onMount } from 'svelte'
  import { type Locale, siteNavigation } from '$lib/site'

  let { locale, path }: { locale: Locale; path: string } = $props()
  const links = $derived(siteNavigation(locale))
  const alternate = $derived(locale === 'ja' ? 'en' : 'ja')
  let dark = $state(false)
  let menu: HTMLDetailsElement | undefined = $state()
  onMount(() => {
    dark = document.documentElement.classList.contains('dark')
  })
  $effect(() => {
    void path
    if (menu) menu.open = false
  })
  function toggleTheme() {
    dark = !dark
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem('theme', dark ? 'dark' : 'light')
    } catch {
      /* Optional preference. */
    }
  }
</script>

<header class="site-header">
  <div class="site-container header-row">
    <a href={`/${locale}`} class="site-brand" aria-label="Shumoku"
      ><img src="/logo-wordmark.svg" alt="Shumoku" width="200.19" height="48.55"></a
    >
    <nav
      class="desktop-nav"
      aria-label={locale === 'ja' ? 'メインナビゲーション' : 'Main navigation'}
    >
      {#each links as link}
        <a href={link.href} aria-current={path === link.path ? 'page' : undefined}>{link.label}</a>
      {/each}
    </nav>
    <div class="header-controls">
      <a
        class="locale-link"
        href={`/${alternate}${path}`}
        onclick={() => rememberLanguage(alternate)}
        lang={alternate}
        aria-label={locale === 'ja' ? 'Switch to English' : '日本語に切り替え'}
        ><Languages size={16} /><span>{alternate === 'ja' ? '日本語' : 'EN'}</span></a
      >
      <button
        class="theme-toggle"
        type="button"
        onclick={toggleTheme}
        aria-label={locale === 'ja' ? 'テーマを切り替え' : 'Toggle theme'}
        aria-pressed={dark}
      >
        {#if dark}
          <Sun size={17} />
        {:else}
          <Moon size={17} />
        {/if}
      </button>
      <details class="mobile-nav" bind:this={menu}>
        <summary aria-label={locale === 'ja' ? 'メニュー' : 'Menu'}><Menu size={21} /></summary>
        <nav aria-label={locale === 'ja' ? 'モバイルナビゲーション' : 'Mobile navigation'}>
          {#each links as link}
            <a href={link.href} aria-current={path === link.path ? 'page' : undefined}
              >{link.label}</a
            >
          {/each}
        </nav>
      </details>
    </div>
  </div>
</header>

<style>
  .site-header {
    border-bottom: 1px solid var(--site-line);
    background: var(--site-bg);
    position: relative;
    z-index: 40;
  }
  .header-row {
    display: flex;
    align-items: center;
    gap: 2rem;
    min-height: calc(var(--site-header-height) - 1px);
  }
  .site-brand {
    flex-shrink: 0;
  }
  .site-brand img {
    width: 150px;
    height: auto;
  }
  .desktop-nav {
    display: flex;
    gap: 1.5rem;
    margin-left: auto;
    align-items: center;
    font-size: 0.875rem;
  }
  nav a {
    color: var(--site-muted);
    text-decoration: none;
  }
  nav a:hover,
  nav a[aria-current] {
    color: var(--site-fg);
    text-decoration: underline;
    text-underline-offset: 6px;
  }
  .header-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .locale-link {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8125rem;
    min-height: 44px;
  }
  .theme-toggle {
    display: grid;
    place-items: center;
    min-width: 44px;
    min-height: 44px;
    padding: 0.4rem;
    cursor: pointer;
  }
  .mobile-nav {
    display: none;
  }
  summary {
    display: grid;
    place-items: center;
    min-width: 44px;
    min-height: 44px;
    cursor: pointer;
    list-style: none;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  .mobile-nav nav {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    display: grid;
    gap: 1.25rem;
    padding: 1.5rem;
    border-bottom: 1px solid var(--site-line);
    background: var(--site-bg);
  }
  @media (max-width: 850px) {
    .desktop-nav {
      display: none;
    }
    .header-controls {
      margin-left: auto;
    }
    .mobile-nav {
      display: block;
    }
    .header-row {
      gap: 1rem;
    }
  }
  @media (max-width: 380px) {
    .header-row {
      gap: 0.5rem;
    }
    .site-brand img {
      width: 125px;
    }
    .header-controls {
      gap: 0.25rem;
    }
  }
</style>
