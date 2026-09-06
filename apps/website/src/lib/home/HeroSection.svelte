<script lang="ts">
  import { homeTranslations, type Locale } from '@shumoku/website-content'
  import Icon from './Icon.svelte'
  import { backgrounds, buttonStyles, cn, docsUrl } from './styles'

  let { locale }: { locale: string } = $props()
  const t = $derived(homeTranslations[locale as Locale]?.hero ?? homeTranslations.en.hero)
</script>
<section class="relative overflow-hidden">
  <div class="absolute inset-0 bg-white dark:bg-neutral-950 pointer-events-none"></div>
  <div class={cn('absolute inset-0 pointer-events-none', backgrounds.hero)}></div>
  <div
    class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:pl-8 lg:pr-0 pt-12 pb-8 sm:pt-16 sm:pb-10 lg:pt-20 lg:pb-12"
  >
    <div class="grid lg:grid-cols-[5fr_7fr] lg:items-center gap-8 lg:gap-12">
      <div class="order-2 lg:order-none">
        <h1
          class="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.98]"
        >
          <span class="text-neutral-900 dark:text-white">{t.title1}</span>
          <br>
          <span
            class="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 bg-clip-text text-transparent whitespace-nowrap"
          >
            {t.title2}
          </span>
        </h1>
        <p
          class="text-base sm:text-lg text-neutral-600 dark:text-neutral-400 mt-4 sm:mt-5 leading-relaxed"
        >
          {t.description1}
          <br>
          {t.description2}
        </p>
        <div class="flex flex-wrap items-center gap-3 mt-6 sm:mt-7">
          <a href={docsUrl(locale, 'server')} class={cn(...buttonStyles.primary)}>
            {t.deploy}
            <Icon value={{ name: 'ArrowRightIcon', class: "w-4 h-4" }} />
          </a>
          <a
            href="https://demo.shumoku.dev/share/topologies/R71ZG1gEigiVY82YKpgDT03I"
            target="_blank"
            rel="noopener noreferrer"
            class={cn(...buttonStyles.secondary)}
          >
            {t.liveDemo}
          </a>
          <a
            href="mailto:contact@shumoku.dev"
            class="inline-flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300 transition-colors"
          >
            {t.demo}
          </a>
          <a
            href="https://github.com/konoe-akitoshi/shumoku"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300 transition-colors"
          >
            <Icon value={{ name: 'GitHubIcon', class: "w-4 h-4" }} />
            {t.githubLabel}
          </a>
        </div>
      </div>
      <div
        class="order-1 lg:order-none rounded-2xl lg:rounded-r-none overflow-hidden border border-neutral-200/70 dark:border-neutral-800/70 lg:border-r-0 shadow-2xl lg:-mr-[10vw]"
      >
        <img
          src="/screenshots/topology.png"
          alt="Topology viewer with live weathermap"
          class="w-full h-auto"
        >
      </div>
    </div>
  </div>
</section>
