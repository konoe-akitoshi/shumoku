<script lang="ts">
  import { Languages, Menu, Moon, Sun } from '@lucide/svelte'
  import { rememberLanguage } from '@shumoku/site-i18n'
  import { onMount } from 'svelte'
  import { type Locale, siteNavigation } from '$lib/site'
  import Disclosure from '$lib/ui/Disclosure.svelte'
  import IconButton from '$lib/ui/IconButton.svelte'
  import LinkButton from '$lib/ui/LinkButton.svelte'
  import NavLink from '$lib/ui/NavLink.svelte'
  import symbol from '../../../../../assets/logos/logo-symbol.svg?url'
  import wordmark from '../../../../../assets/logos/logo-wordmark.svg?url'
  import '../../../../../assets/logos/header-logo.css'

  let { locale, path }: { locale: Locale; path: string } = $props()
  const links = $derived(siteNavigation(locale))
  const alternate = $derived(locale === 'ja' ? 'en' : 'ja')
  let dark = $state(false)
  onMount(() => {
    dark = document.documentElement.classList.contains('dark')
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
        <NavLink href={link.href} aria-current={path === link.path ? 'page' : undefined}
          >{link.label}</NavLink
        >
      {/each}
    </nav>
    <div class="header-controls">
      <LinkButton
        variant="ghost"
        size="icon"
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
      </LinkButton>
      <LinkButton
        variant="ghost"
        class="locale-link"
        href={`/${alternate}${path}`}
        onclick={() => rememberLanguage(alternate)}
        lang={alternate}
        aria-label={locale === 'ja' ? 'Switch to English' : '日本語に切り替え'}
        ><Languages size={20} /><span>{alternate === 'ja' ? '日本語' : 'EN'}</span></LinkButton
      >
      <IconButton
        type="button"
        onclick={toggleTheme}
        label={locale === 'ja' ? 'テーマを切り替え' : 'Toggle theme'}
        aria-pressed={dark}
      >
        {#if dark}
          <Sun size={20} />
        {:else}
          <Moon size={20} />
        {/if}
      </IconButton>
      <div class="mobile-nav">
        <Disclosure
          label={locale === 'ja' ? 'メニュー' : 'Menu'}
          icon
          variant="ghost"
          resetKey={`${locale}${path}`}
        >
          {#snippet trigger()}
            <Menu size={20} />
          {/snippet}
          {#each links as link}
            <NavLink href={link.href} aria-current={path === link.path ? 'page' : undefined}
              >{link.label}</NavLink
            >
          {/each}
        </Disclosure>
      </div>
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
    gap: var(--ui-space-6);
    min-height: calc(var(--site-header-height) - 1px);
  }
  .site-brand {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    min-height: var(--ui-control-height);
    min-width: var(--ui-control-height);
    font-size: 1rem;
  }
  .desktop-nav {
    display: flex;
    gap: var(--ui-space-2);
    margin-left: auto;
    align-items: center;
  }
  .header-controls {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
    border-left: 1px solid var(--site-line);
    padding-left: var(--ui-space-4);
  }
  .mobile-nav {
    display: none;
  }
  @media (max-width: 850px) {
    .header-controls :global(.locale-link) {
      width: var(--ui-control-height);
      padding: 0;
    }
    .header-controls :global(.locale-link span) {
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
      gap: var(--ui-space-4);
    }
  }
</style>
