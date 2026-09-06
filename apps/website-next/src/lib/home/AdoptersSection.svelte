<script lang="ts">
  import { homeTranslations, type Locale } from '@shumoku/website-content'

  type Adopter = {
    name: string
    logo: string
    url?: string
  }
  const adopters: Adopter[] = [
    {
      name: '電気通信大学 情報基盤センター',
      logo: '/adopters/itcuec_logo_300.png',
      url: 'https://www.cc.uec.ac.jp/',
    },
    {
      name: 'JANOG57',
      logo: '/adopters/janog57_logo.png',
      url: 'https://www.janog.gr.jp/meeting/janog57/',
    },
  ]
  let { locale }: { locale: string } = $props()
  const label = $derived(
    homeTranslations[locale as Locale]?.adopters?.title ?? homeTranslations.en.adopters.title,
  )
</script>
<section class="py-6 sm:py-8">
  <div class="flex flex-col items-center gap-3">
    <span class="text-sm text-neutral-500 dark:text-neutral-500">{label}</span>
    <div class="flex items-center gap-8">
      {#each adopters as adopter}
        {#if adopter.url}
          <a href={adopter.url} target="_blank" rel="noopener noreferrer" title={adopter.name}>
            <img
              src={adopter.logo}
              alt={adopter.name}
              width={180}
              height={54}
              class="h-10 sm:h-12 w-auto object-contain"
            >
          </a>
        {:else}
          <img
            src={adopter.logo}
            alt={adopter.name}
            width={180}
            height={54}
            class="h-10 sm:h-12 w-auto object-contain"
          >
        {/if}
      {/each}
    </div>
  </div>
</section>
