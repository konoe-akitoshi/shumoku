<script lang="ts">
  import { homeTranslations, type Locale } from '@shumoku/website-content'
  import alert from '$lib/assets/screenshots/alert.png?enhanced'
  import icon from '$lib/assets/screenshots/icon.png?enhanced'
  import netbox from '$lib/assets/screenshots/netbox.png?enhanced'
  import share from '$lib/assets/screenshots/share.png?enhanced'
  import weathermap from '$lib/assets/screenshots/wethermap.png?enhanced'
  import zoom from '$lib/assets/screenshots/zoom.png?enhanced'
  import FeatureCard from './FeatureCard.svelte'
  import FeatureIconCard from './FeatureIconCard.svelte'

  import { cn, sectionStyles } from './styles'

  let { locale }: { locale: string } = $props()
  const t = $derived(homeTranslations[locale as Locale]?.features ?? homeTranslations.en.features)
  const items = $derived(t.items)
  // Grid of three columns from `sm`, one full-width column below it.
  const cellSizes = '(min-width: 640px) 380px, calc(100vw - 2rem)'
  const wideSizes = '(min-width: 640px) 780px, calc(100vw - 2rem)'
</script>
<section
  id="website-features"
  class={cn('relative overflow-hidden scroll-mt-8', sectionStyles.padding)}
>
  <div class="site-container">
    <h2 class={cn(sectionStyles.title, 'mb-8 sm:mb-12')}>{t.title}</h2>

    <div class="grid grid-cols-1 sm:grid-cols-3 sm:grid-rows-[180px_180px_200px] gap-4">
      <FeatureCard
        title={items[0].title}
        description={items[0].description}
        image={weathermap}
        imageAlt="Live weathermap with traffic tooltip"
        sizes={wideSizes}
        class="sm:col-span-2 sm:row-span-2"
      ></FeatureCard>

      <FeatureCard
        title={items[1].title}
        description={items[1].description}
        image={alert}
        imageAlt="Alert overlay on topology"
        sizes={cellSizes}
      ></FeatureCard>

      <FeatureCard
        title={items[2].title}
        description={items[2].description}
        image={netbox}
        imageAlt="NetBox topology source configuration"
        sizes={cellSizes}
      ></FeatureCard>

      <FeatureCard
        title={items[4].title}
        description={items[4].description}
        image={icon}
        imageAlt="Vendor icons rendered at correct aspect ratios"
        sizes={cellSizes}
      ></FeatureCard>
      <FeatureCard
        title={items[3].title}
        description={items[3].description}
        image={zoom}
        imageAlt="Pan and zoom controls"
        sizes={cellSizes}
      ></FeatureCard>
      <FeatureCard
        title={items[5].title}
        description={items[5].description}
        image={share}
        imageAlt="Share link dialog"
        sizes={cellSizes}
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
