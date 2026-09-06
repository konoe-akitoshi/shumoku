<script lang="ts">
  import { homeTranslations, type Locale } from '@shumoku/website-content'
  import Icon from './Icon.svelte'
  import LayerCta from './LayerCta.svelte'
  import { cn, sectionStyles } from './styles'

  const layerIcons = [
    { name: 'Layers', class: 'w-5 h-5' },
    { name: 'Terminal', class: 'w-5 h-5' },
    { name: 'Server', class: 'w-5 h-5' },
    { name: 'PencilRuler', class: 'w-5 h-5' },
  ]
  let { locale }: { locale: string } = $props()
  const t = $derived(homeTranslations[locale as Locale]?.platform ?? homeTranslations.en.platform)
</script>
<section class={cn('relative overflow-hidden', sectionStyles.padding)}>
  <div class="max-w-6xl mx-auto">
    <h2 class={cn(sectionStyles.title, 'text-center mb-3')}>{t.title}</h2>
    <p
      class="text-sm text-neutral-500 dark:text-neutral-500 text-center max-w-2xl mx-auto mb-8 sm:mb-12"
    >
      {t.description}
    </p>
    <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {#each t.layers as layer, i}
        <div
          class="flex flex-col rounded-2xl border border-neutral-200/70 dark:border-neutral-700/50 bg-white/90 dark:bg-neutral-800/60 p-5"
        >
          <div
            class="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200/50 dark:border-emerald-700/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3"
          >
            <Icon value={layerIcons[i]} />
          </div>
          <h3 class="text-sm font-semibold mb-1">{layer.title}</h3>
          <p class="text-xs text-neutral-500 dark:text-neutral-500 flex-1">{layer.description}</p>
          {#if 'cta' in layer && 'href' in layer && layer.cta && layer.href}
            <LayerCta href={layer.href} label={layer.cta} {locale}></LayerCta>
          {/if}
        </div>
      {/each}
    </div>
    <div class="text-center mt-8">
      <a
        href={`/${locale}#about`}
        class="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
      >
        {t.philosophyCta}
        →
      </a>
    </div>
  </div>
</section>
