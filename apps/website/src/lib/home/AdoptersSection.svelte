<script lang="ts">
  import { homeTranslations, type Locale } from '@shumoku/website-content'
  import type { Picture } from 'vite-imagetools'
  import itcuecLogo from '$lib/assets/adopters/itcuec_logo_300.png?enhanced'
  import janog57Logo from '$lib/assets/adopters/janog57_logo.png?enhanced'

  type Adopter = {
    name: string
    logo: Picture
    url?: string
  }
  const adopters: Adopter[] = [
    {
      name: '電気通信大学 情報基盤センター',
      logo: itcuecLogo,
      url: 'https://www.cc.uec.ac.jp/',
    },
    {
      name: 'JANOG57',
      logo: janog57Logo,
      url: 'https://www.janog.gr.jp/meeting/janog57/',
    },
  ]
  let { locale }: { locale: string } = $props()
  const label = $derived(
    homeTranslations[locale as Locale]?.adopters?.title ?? homeTranslations.en.adopters.title,
  )
  // Logos render 40px (48px from `sm`) tall; width follows each logo's aspect ratio.
  const logoSizes = '(min-width: 640px) 120px, 100px'
</script>
<section class="py-6 sm:py-8">
  <div class="site-container flex flex-wrap items-center justify-between gap-5">
    <span class="text-sm text-neutral-500 dark:text-neutral-500">{label}</span>
    <div class="flex items-center gap-8">
      {#each adopters as adopter}
        {#if adopter.url}
          <a href={adopter.url} target="_blank" rel="noopener noreferrer" title={adopter.name}>
            <enhanced:img
              src={adopter.logo}
              alt={adopter.name}
              sizes={logoSizes}
              loading="lazy"
              decoding="async"
              class="h-10 sm:h-12 w-auto object-contain"
            />
          </a>
        {:else}
          <enhanced:img
            src={adopter.logo}
            alt={adopter.name}
            sizes={logoSizes}
            loading="lazy"
            decoding="async"
            class="h-10 sm:h-12 w-auto object-contain"
          />
        {/if}
      {/each}
    </div>
  </div>
</section>
