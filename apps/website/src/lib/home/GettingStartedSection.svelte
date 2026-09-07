<script lang="ts">
  import { homeTranslations, type Locale } from '@shumoku/website-content'
  import Icon from './Icon.svelte'
  import { buttonStyles, cn, docsUrl, sectionStyles } from './styles'

  let { locale }: { locale: Locale } = $props()
  const t = $derived(homeTranslations[locale]?.gettingStarted ?? homeTranslations.en.gettingStarted)
</script>
<section class={cn('relative overflow-hidden', sectionStyles.padding)}>
  <div class="site-container">
    <h2 class={cn(sectionStyles.title, 'mb-8 sm:mb-12')}>{t.title}</h2>
    <div class="grid md:grid-cols-2 gap-6">
      <div
        class="rounded-2xl border border-neutral-200/70 dark:border-neutral-700/50 bg-white/90 dark:bg-neutral-800/60 flex flex-col"
      >
        <div
          class="flex items-center gap-1.5 px-4 py-3 border-b border-neutral-200/70 dark:border-neutral-700/50"
        >
          <div class="flex gap-1.5">
            <div class="w-2.5 h-2.5 rounded-full bg-red-400/60 dark:bg-red-500/70"></div>
            <div class="w-2.5 h-2.5 rounded-full bg-yellow-400/60 dark:bg-yellow-500/70"></div>
            <div class="w-2.5 h-2.5 rounded-full bg-green-400/60 dark:bg-green-500/70"></div>
          </div>
          <span class="text-xs text-neutral-500 dark:text-neutral-500 ml-1.5">
            {t.community.label}
          </span>
        </div>
        <div class="px-5 pt-5 space-y-2.5 flex-1">
          {#each t.community.steps as step}
            {@const isCommand = /^[a-z]/.test(step)}
            <div class="flex items-start gap-2.5">
              <span
                class="text-emerald-600 dark:text-emerald-400 shrink-0 select-none font-mono text-sm mt-px"
              >
                {#if isCommand}
                  {'$'}
                {:else}
                  {'→'}
                {/if}
              </span>
              <span
                class={cn(
                        'text-sm',
                        isCommand
                          ? 'font-mono text-neutral-700 dark:text-neutral-300'
                          : 'text-neutral-600 dark:text-neutral-400',
                      )}
              >
                {step}
              </span>
            </div>
          {/each}
        </div>
        <div class="px-5 pb-5 pt-5">
          <a href={docsUrl(locale, 'server')} class={cn(...buttonStyles.secondary, 'text-sm')}>
            {t.community.cta}
            <Icon value={{ name: 'ArrowRightIcon', class: "w-3.5 h-3.5" }} />
          </a>
        </div>
      </div>

      <div
        class="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex flex-col"
      >
        <div class="px-6 pt-6 mb-5">
          <span
            class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider"
          >
            {t.production.label}
          </span>
        </div>
        <ul class="px-6 space-y-2.5 flex-1">
          {#each t.production.items as item}
            <li class="flex items-start gap-2.5 text-sm text-neutral-700 dark:text-neutral-300">
              <svg
                aria-hidden="true"
                class="w-4 h-4 text-emerald-500 mt-0.5 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              {item}
            </li>
          {/each}
        </ul>
        <div class="px-6 pb-6 pt-5">
          <a href="mailto:contact@shumoku.dev" class={cn(...buttonStyles.primary, 'text-sm')}>
            {t.production.cta}
            <Icon value={{ name: 'ArrowRightIcon', class: "w-4 h-4" }} />
          </a>
        </div>
      </div>
    </div>
  </div>
</section>
