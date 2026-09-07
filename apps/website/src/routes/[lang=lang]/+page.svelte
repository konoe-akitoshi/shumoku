<script lang="ts">
  import { homeTranslations } from '@shumoku/website-content'
  import AdoptersSection from '$lib/home/AdoptersSection.svelte'
  import BottomSection from '$lib/home/BottomSection.svelte'
  import FeaturesSection from '$lib/home/FeaturesSection.svelte'
  import GallerySection from '$lib/home/GallerySection.svelte'
  import GettingStartedSection from '$lib/home/GettingStartedSection.svelte'
  import HeroSection from '$lib/home/HeroSection.svelte'
  import IntegrationsSection from '$lib/home/IntegrationsSection.svelte'
  import PlatformSection from '$lib/home/PlatformSection.svelte'
  import PageMeta from '$lib/PageMeta.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  const lang = $derived(data.lang)
  const t = $derived(homeTranslations[lang])
</script>
<PageMeta
  title={`Shumoku — ${t.hero.title1} ${t.hero.title2}`}
  description={`${t.hero.description1} ${t.hero.description2}`}
/>
<main id="main" class="flex-1">
  <HeroSection locale={lang} />
  <AdoptersSection locale={lang} />
  <PlatformSection locale={lang} />
  <FeaturesSection locale={lang} />
  <IntegrationsSection locale={lang} />
  <GallerySection locale={lang} />
  <GettingStartedSection locale={lang} />
  <BottomSection locale={lang} />
</main>
