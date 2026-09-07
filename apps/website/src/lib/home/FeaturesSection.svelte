<script lang="ts">
  import { homeTranslations, type Locale } from '@shumoku/website-content'
  import FeatureCard from './FeatureCard.svelte'
  import FeatureIconCard from './FeatureIconCard.svelte'

  import { cn, sectionStyles } from './styles'

  let { locale }: { locale: string } = $props()
  const t = $derived(homeTranslations[locale as Locale]?.features ?? homeTranslations.en.features)
  const items = $derived(t.items)
</script>
<section class={cn('relative overflow-hidden', sectionStyles.padding)}>
  <div class="site-container">
    <h2 class={cn(sectionStyles.title, 'mb-8 sm:mb-12')}>{t.title}</h2>

    <div class="grid grid-cols-1 sm:grid-cols-3 sm:grid-rows-[180px_180px_200px] gap-4">
      <FeatureCard
        title={items[0].title}
        description={items[0].description}
        image="/screenshots/wethermap.png"
        imageAlt="Live weathermap with traffic tooltip"
        class="sm:col-span-2 sm:row-span-2"
      ></FeatureCard>

      <FeatureCard
        title={items[1].title}
        description={items[1].description}
        image="/screenshots/alert.png"
        imageAlt="Alert overlay on topology"
      ></FeatureCard>

      <FeatureCard
        title={items[2].title}
        description={items[2].description}
        image="/screenshots/netbox.png"
        imageAlt="NetBox topology source configuration"
      ></FeatureCard>

      <FeatureCard
        title={items[4].title}
        description={items[4].description}
        image="/screenshots/icon.png"
        imageAlt="Vendor icons rendered at correct aspect ratios"
      ></FeatureCard>
      <FeatureCard
        title={items[3].title}
        description={items[3].description}
        image="/screenshots/zoom.png"
        imageAlt="Pan and zoom controls"
      ></FeatureCard>
      <FeatureCard
        title={items[5].title}
        description={items[5].description}
        image="/screenshots/share.png"
        imageAlt="Share link dialog"
      ></FeatureCard>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
      <FeatureIconCard
        title={items[6].title}
        description={items[6].description}
        icon={{ name: 'Radar', class: "w-5 h-5" }}
      ></FeatureIconCard>
      <FeatureIconCard
        title={items[7].title}
        description={items[7].description}
        icon={{ name: 'LayoutGrid', class: "w-5 h-5" }}
      ></FeatureIconCard>
    </div>
  </div>
</section>
