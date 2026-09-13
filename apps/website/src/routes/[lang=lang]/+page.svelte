<script lang="ts">
  import { homeTranslations } from '@shumoku/website-content'
  import ActivitySection from '$lib/home/ActivitySection.svelte'
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
  <div class="home-band home-band--surface"><AdoptersSection locale={lang} /></div>
  <GallerySection locale={lang} />
  <div class="home-band home-band--surface"><FeaturesSection locale={lang} /></div>
  <IntegrationsSection locale={lang} />
  <div class="home-band home-band--surface"><PlatformSection locale={lang} /></div>
  <GettingStartedSection locale={lang} />
  <div class="home-band home-band--brand"><ActivitySection locale={lang} /></div>
  <div class="home-band home-band--surface"><BottomSection locale={lang} /></div>
</main>

<style>
  .home-band {
    color: var(--site-fg);
  }
  .home-band--surface {
    background: var(--site-section-alt);
  }
  .home-band--brand {
    background: var(--site-brand-wash);
  }
</style>
