<script lang="ts">
  import { Languages, Menu, Moon, Sun } from '@lucide/svelte'
  import { rememberLanguage } from '@shumoku/site-i18n'
  import { onMount } from 'svelte'
  import { type Locale, siteNavigation } from '$lib/site'
  import symbol from '../../../../../assets/logos/logo-symbol.svg?url'
  import wordmark from '../../../../../assets/logos/logo-wordmark.svg?url'
  import '../../../../../assets/logos/header-logo.css'

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
  function closeMenu(event: MouseEvent) {
    if (menu && event.target instanceof Node && !menu.contains(event.target)) menu.open = false
  }
  function escapeMenu(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !menu?.open) return
    const focused = menu.contains(document.activeElement)
    menu.open = false
    if (focused) menu.querySelector('summary')?.focus()
  }
</script>

<svelte:window onclick={closeMenu} onkeydown={escapeMenu} />

<header class="site-header">
  <div class="site-container header-row">
    <a href={`/${locale}`} class="site-brand" aria-label="Shumoku"
      ><picture class="shumoku-header-logo">
        <source media="(max-width: 850px)" srcset={symbol}>
        <img src={wordmark} alt="Shumoku">
      </picture></a
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
        class="icon-link"
        href="https://github.com/konoe-akitoshi/shumoku"
        aria-label={locale === 'ja' ? 'Shumoku の GitHub リポジトリ' : 'Shumoku on GitHub'}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path
            d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3.3-.4 6.8-1.6 6.8-7A5.4 5.4 0 0 0 19.4 4a5 5 0 0 0-.1-3.5S18.2.1 15 1.8a13.4 13.4 0 0 0-7 0C4.8.1 3.7.5 3.7.5A5 5 0 0 0 3.6 4a5.4 5.4 0 0 0-1.4 3.7c0 5.4 3.5 6.6 6.8 7A4.8 4.8 0 0 0 8 18v4"
          />
          <path d="M8 19c-3 .9-3-1.5-4-2" />
        </svg>
      </a>
      <a
        class="locale-link"
        href={`/${alternate}${path}`}
        onclick={() => rememberLanguage(alternate)}
        lang={alternate}
        aria-label={locale === 'ja' ? 'Switch to English' : '日本語に切り替え'}
        ><Languages size={20} /><span>{alternate === 'ja' ? '日本語' : 'EN'}</span></a
      >
      <button
        class="theme-toggle"
        type="button"
        onclick={toggleTheme}
        aria-label={locale === 'ja' ? 'テーマを切り替え' : 'Toggle theme'}
        aria-pressed={dark}
      >
        {#if dark}
          <Sun size={20} />
        {:else}
          <Moon size={20} />
        {/if}
      </button>
      <details class="mobile-nav" bind:this={menu}>
        <summary aria-label={locale === 'ja' ? 'メニュー' : 'Menu'}><Menu size={20} /></summary>
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
    display: flex;
    align-items: center;
    min-height: var(--site-control-size);
    min-width: var(--site-control-size);
    font-size: 1rem;
  }
  .desktop-nav {
    display: flex;
    gap: var(--site-space);
    margin-left: auto;
    align-items: center;
    font-size: 0.875rem;
  }
  nav a {
    color: var(--site-muted);
    text-decoration: none;
  }
  .desktop-nav a,
  .mobile-nav a,
  .header-controls > a,
  .theme-toggle,
  summary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--site-space);
    min-width: var(--site-control-size);
    min-height: var(--site-control-size);
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    color: var(--site-muted);
    font-size: 0.875rem;
    line-height: 1.5rem;
    white-space: nowrap;
  }
  nav a:hover,
  nav a[aria-current] {
    color: var(--site-fg);
    text-decoration: underline;
    text-underline-offset: 6px;
  }
  .header-controls > a:hover,
  .theme-toggle:hover,
  summary:hover {
    background: var(--site-line);
    color: var(--site-fg);
  }
  .header-controls {
    display: flex;
    align-items: center;
    gap: var(--site-space);
    border-left: 1px solid var(--site-line);
    padding-left: calc(2 * var(--site-space));
  }
  .theme-toggle {
    cursor: pointer;
  }
  .mobile-nav {
    display: none;
  }
  summary {
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
    gap: var(--site-space);
    padding: 1rem;
    border-bottom: 1px solid var(--site-line);
    background: var(--site-bg);
  }
  @media (max-width: 850px) {
    .locale-link span {
      display: none;
    }
    .desktop-nav {
      display: none;
    }
    .header-controls {
      margin-left: auto;
      border: 0;
      padding: 0;
      gap: 0;
    }
    .mobile-nav {
      display: block;
    }
    .header-row {
      gap: 1rem;
    }
  }
  .header-controls > .icon-link,
  .theme-toggle,
  summary {
    width: var(--site-control-size);
    padding: 0;
  }
  .mobile-nav a {
    justify-content: flex-start;
  }
</style>
