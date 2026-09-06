<script lang="ts">
  import { homeTranslations, type Locale } from '@shumoku/website-content'
  import Icon, { type IconDescriptor } from './Icon.svelte'
  import { backgrounds, buttonStyles, cn, docsUrl, sectionStyles } from './styles'

  const icons: Record<string, IconDescriptor> = {
    GitHub: { name: 'GitHubIcon', class: 'w-4 h-4' },
    X: { name: 'XIcon', class: 'w-4 h-4' },
    Email: { name: 'EmailIcon', class: 'w-4 h-4' },
  }
  let { locale }: { locale: string } = $props()
  const t = $derived(homeTranslations[locale as Locale]?.bottom ?? homeTranslations.en.bottom)
</script>
<section class={cn('relative overflow-hidden', sectionStyles.padding)}>
  <div class={cn('absolute inset-0 pointer-events-none', backgrounds.cta)}></div>
  <div class="relative max-w-3xl mx-auto">
    <h2 class={cn(sectionStyles.title, 'text-center mb-8')}>{t.faq.title}</h2>
    <div class="space-y-5 mb-12 sm:mb-16">
      {#each t.faq.items as item}
        <div class="border-b border-neutral-200 dark:border-neutral-800 pb-5">
          <h3 class="text-sm font-semibold mb-1.5">{item.question}</h3>
          <p class="text-sm text-neutral-600 dark:text-neutral-400">{item.answer}</p>
          {#if 'cta' in item && item.cta}
            <a
              href={`/${locale}${item.cta.href}`}
              class="inline-block text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline mt-2"
            >
              {item.cta.label}
              →
            </a>
          {/if}
        </div>
      {/each}
    </div>

    <div class="flex justify-center gap-3 mb-12 sm:mb-16">
      {#each t.community.items as item}
        <a
          href={item.url}
          target={item.url.startsWith('mailto:') ? undefined : '_blank'}
          rel={item.url.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm text-neutral-600 dark:text-neutral-400 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
        >
          <Icon value={icons[item.name]} />
          {item.name}
        </a>
      {/each}
    </div>

    <div class="text-center">
      <h2 class={cn(sectionStyles.title, 'mb-6 sm:mb-8')}>{t.cta.title}</h2>
      <div class="flex flex-wrap gap-3 justify-center">
        <a href={docsUrl(locale, 'server')} class={cn(...buttonStyles.primaryLarge)}>
          {t.cta.deploy}
          <Icon value={{ name: 'ArrowRightIcon', class: "w-4 h-4" }} />
        </a>
        <a href="mailto:contact@shumoku.dev" class={cn(...buttonStyles.secondaryLarge)}>
          {t.cta.contact}
        </a>
      </div>
    </div>
  </div>
</section>
