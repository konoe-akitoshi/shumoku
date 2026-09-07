<script lang="ts">
  import { Languages, Menu, Moon, Search, Sun } from '@lucide/svelte'
  import { rememberLanguage } from '@shumoku/site-i18n'
  import { onMount } from 'svelte'
  import Icon from './Icon.svelte'

  let { locale, path = '' }: { locale: 'en' | 'ja'; path?: '' | '/playground' } = $props()
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
      /* Storage may be disabled. */
    }
  }
</script>

<header
  class="sticky top-0 z-50 border-b border-neutral-200/60 bg-white/80 backdrop-blur-lg dark:border-neutral-800 dark:bg-neutral-950/80"
>
  <nav
    class="relative mx-auto flex h-14 max-w-[1440px] items-center gap-6 px-4 text-sm text-neutral-600 dark:text-neutral-400"
    aria-label={locale === 'ja' ? 'メインナビゲーション' : 'Main navigation'}
  >
    <a href={`/${locale}`} class="shrink-0"
      ><img src="/logo-horizontal.svg" alt="Shumoku" class="h-8 w-auto"></a
    >
    <div class="hidden items-center gap-6 md:flex">
      <a href={`https://docs.shumoku.dev/${locale}`}>Docs</a>
      <a href={`/${locale}/playground`}>Playground</a>
      <a href="https://editor.shumoku.dev/">Editor</a>
    </div>
    <div class="ml-auto flex items-center gap-3">
      <a
        href={`https://docs.shumoku.dev/${locale}`}
        class="flex items-center gap-2 rounded-full border border-neutral-200 p-2 dark:border-neutral-800"
        aria-label={locale === 'ja' ? 'Docsで検索' : 'Search in Docs'}
      >
        <Search size={16} />
        <span class="hidden lg:inline"
          >{locale === 'ja' ? 'ドキュメントを検索' : 'Search documentation'}</span
        >
      </a>
      <button
        type="button"
        onclick={toggleTheme}
        class="flex items-center gap-1 rounded-full border border-neutral-200 p-1 dark:border-neutral-800"
        aria-label={locale === 'ja' ? 'テーマを切り替え' : 'Toggle theme'}
        aria-pressed={dark}
      >
        <Sun size={22} class={!dark ? 'rounded-full bg-neutral-100 p-1' : 'p-1'} />
        <Moon size={22} class={dark ? 'rounded-full bg-neutral-800 p-1' : 'p-1'} />
      </button>
      <details class="relative">
        <summary
          class="cursor-pointer list-none p-1 [&::-webkit-details-marker]:hidden"
          aria-label={locale === 'ja' ? '言語を選択' : 'Select language'}
        >
          <Languages size={20} />
        </summary>
        <div
          class="absolute right-0 top-9 grid min-w-32 gap-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-800 dark:bg-neutral-950"
        >
          <a
            href={`/en${path}`}
            onclick={() => rememberLanguage('en')}
            lang="en"
            aria-current={locale === 'en' ? 'page' : undefined}
            >English</a
          >
          <a
            href={`/ja${path}`}
            onclick={() => rememberLanguage('ja')}
            lang="ja"
            aria-current={locale === 'ja' ? 'page' : undefined}
            >日本語</a
          >
        </div>
      </details>
      <a
        class="hidden sm:block"
        href="https://github.com/konoe-akitoshi/shumoku"
        aria-label="GitHub"
        ><Icon value={{ name: 'GitHubIcon', class: 'h-5 w-5' }} /></a
      >
      <details class="md:hidden">
        <summary
          class="cursor-pointer list-none [&::-webkit-details-marker]:hidden"
          aria-label={locale === 'ja' ? 'メニュー' : 'Menu'}
        >
          <Menu size={20} />
        </summary>
        <div
          class="absolute inset-x-0 top-14 grid gap-4 border-b border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950"
        >
          <a href={`https://docs.shumoku.dev/${locale}`}>Docs</a>
          <a href={`/${locale}/playground`}>Playground</a>
          <a href="https://editor.shumoku.dev/">Editor</a>
          <a href="https://github.com/konoe-akitoshi/shumoku">GitHub</a>
        </div>
      </details>
    </div>
  </nav>
</header>
