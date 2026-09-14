<script lang="ts">
  import { homeTranslations, type Locale } from '@shumoku/website-content'
  import type { Picture } from 'vite-imagetools'
  import dashboard from '../../../../../assets/screenshots/dashboard.png?enhanced'
  import topology from '../../../../../assets/screenshots/topology.png?enhanced'
  import { cn, sectionStyles } from './styles'

  // Content keeps stable public paths; the website serves optimized builds of the same images.
  const pictures: Record<string, Picture> = {
    '/screenshots/topology.png': topology,
    '/screenshots/dashboard.png': dashboard,
  }

  let { locale }: { locale: string } = $props()
  const t = $derived(homeTranslations[locale as Locale]?.gallery ?? homeTranslations.en.gallery)
  const forTeams = $derived(
    homeTranslations[locale as Locale]?.forTeams ?? homeTranslations.en.forTeams,
  )
</script>
<section class={cn('relative overflow-hidden', sectionStyles.padding)}>
  <div class="site-container">
    <h2 class={cn(sectionStyles.title, 'mb-8 sm:mb-12')}>{t.title}</h2>

    <div class="grid md:grid-cols-2 gap-6 mb-10 sm:mb-14">
      {#each t.items as item}
        <div>
          <div class="rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800">
            {#if pictures[item.src]}
              <enhanced:img
                src={pictures[item.src]}
                alt={item.alt}
                sizes="(min-width: 768px) 580px, calc(100vw - 2rem)"
                loading="lazy"
                decoding="async"
                class="block w-full h-auto"
              />
            {:else}
              <img src={item.src} alt={item.alt} loading="lazy" class="w-full h-auto">
            {/if}
          </div>
          <p class="text-xs text-neutral-500 dark:text-neutral-500 mt-2 text-center">
            {item.caption}
          </p>
        </div>
      {/each}
    </div>

    <div class="grid md:grid-cols-2 gap-4">
      {#each forTeams.adopters.items as item}
        <div
          class="rounded-xl border border-neutral-200/70 dark:border-neutral-700/50 p-5 bg-white/90 dark:bg-neutral-800/60"
        >
          <p class="text-sm text-neutral-700 dark:text-neutral-300 mb-3 leading-relaxed">
            &ldquo;{item.quote}&rdquo;
          </p>
          <p class="text-xs text-neutral-500">{item.attribution}</p>
        </div>
      {/each}
    </div>
  </div>
</section>
