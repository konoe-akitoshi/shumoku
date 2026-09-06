<script lang="ts">
  import { homeTranslations, type Locale } from '@shumoku/website-content'
  import CoreNode from './CoreNode.svelte'
  import DashedConnector from './DashedConnector.svelte'

  import SatelliteNode from './SatelliteNode.svelte'
  import { buttonStyles, cn, sectionStyles } from './styles'

  const nodeIcons = [
    { name: 'Code2', class: 'w-5 h-5' },
    { name: 'Package', class: 'w-5 h-5' },
    { name: 'Plug', class: 'w-5 h-5' },
    { name: 'MapIcon', class: 'w-5 h-5' },
  ]
  let { locale }: { locale: string } = $props()
  const t = $derived(homeTranslations[locale as Locale]?.forTeams ?? homeTranslations.en.forTeams)
</script>
<section class={cn('relative overflow-hidden', sectionStyles.padding)}>
  <div class="max-w-4xl mx-auto">
    <p class="text-sm text-emerald-600 dark:text-emerald-400/80 text-center leading-relaxed mb-6">
      {t.tagline1}
      <br>
      {t.tagline2}
    </p>

    <h2 class={cn(sectionStyles.title, 'text-center mb-16')}>{t.title}</h2>

    <div class="hidden lg:flex flex-col items-center">
      <SatelliteNode
        title={t.nodes[0].title}
        description={t.nodes[0].description}
        icon={nodeIcons[0]}
      ></SatelliteNode>
      <DashedConnector orientation="vertical"></DashedConnector>

      <div class="flex items-center justify-center">
        <SatelliteNode
          title={t.nodes[1].title}
          description={t.nodes[1].description}
          icon={nodeIcons[1]}
        ></SatelliteNode>
        <DashedConnector orientation="horizontal"></DashedConnector>
        <CoreNode></CoreNode>
        <DashedConnector orientation="horizontal"></DashedConnector>
        <SatelliteNode
          title={t.nodes[2].title}
          description={t.nodes[2].description}
          icon={nodeIcons[2]}
        ></SatelliteNode>
      </div>
      <DashedConnector orientation="vertical"></DashedConnector>

      <SatelliteNode
        title={t.nodes[3].title}
        description={t.nodes[3].description}
        icon={nodeIcons[3]}
      ></SatelliteNode>
    </div>

    <div class="lg:hidden flex flex-col items-center gap-8">
      <CoreNode></CoreNode>
      <div class="grid grid-cols-2 gap-6 max-w-sm">
        {#each t.nodes as node, i}
          <SatelliteNode
            title={node.title}
            description={node.description}
            icon={nodeIcons[i]}
          ></SatelliteNode>
        {/each}
      </div>
    </div>

    <div class="flex flex-wrap items-center justify-center gap-2 mt-14">
      <span class="text-xs font-semibold text-neutral-500 uppercase tracking-wider mr-1">
        {t.roadmapLabel}
      </span>
      {#each t.roadmap as item}
        <div
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-neutral-200/70 dark:border-neutral-700/50 bg-white dark:bg-neutral-800"
        >
          <div class="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
          <span class="text-xs text-neutral-600 dark:text-neutral-400">{item}</span>
        </div>
      {/each}
    </div>

    <p
      class="text-xs text-neutral-500 dark:text-neutral-500 text-center max-w-xl mx-auto mt-10 leading-relaxed"
    >
      {t.supportNote}{' '}
      <a
        href={`/${locale}#enterprise`}
        class="font-medium text-emerald-600 dark:text-emerald-400 hover:underline whitespace-nowrap"
      >
        {t.supportCta}
        →
      </a>
    </p>

    <div class="text-center mt-6">
      <a href="mailto:contact@shumoku.dev" class={cn(...buttonStyles.primary)}> {t.cta} </a>
    </div>
  </div>
</section>
