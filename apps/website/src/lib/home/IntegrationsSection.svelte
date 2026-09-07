<script lang="ts">
  import { homeTranslations, type Locale } from '@shumoku/website-content'
  import CenterDemo from './CenterDemo.svelte'
  import DashedLine from './DashedLine.svelte'

  import NodeCard from './NodeCard.svelte'
  import { cn, sectionStyles } from './styles'

  let { locale }: { locale: string } = $props()
  const t = $derived(
    homeTranslations[locale as Locale]?.integrations ?? homeTranslations.en.integrations,
  )
</script>
<section class={cn('relative overflow-hidden', sectionStyles.padding)}>
  <div class="site-container">
    <h2 class={cn(sectionStyles.title, 'mb-8 sm:mb-12')}>{t.title}</h2>

    <div class="hidden lg:grid lg:grid-cols-[1fr_2fr_1fr] gap-4 items-center">
      <div>
        <div
          class="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3 text-right"
        >
          {t.inputLabel}
        </div>
        <div class="space-y-3">
          {#each t.inputs as item}
            <div class="flex items-center gap-2 justify-end">
              <NodeCard
                title={item.title}
                description={item.description}
                tag={item.tag}
                logo={'logo' in item ? item.logo : undefined}
              ></NodeCard>
              <DashedLine direction="right"></DashedLine>
            </div>
          {/each}
        </div>
      </div>

      <CenterDemo description={t.centerDescription}></CenterDemo>

      <div>
        <div class="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
          {t.monitoringLabel}
        </div>
        <div class="space-y-3">
          {#each t.monitoring as item}
            <div class="flex items-center gap-2">
              <DashedLine direction="left"></DashedLine>
              <NodeCard
                title={item.title}
                description={item.description}
                tag={item.tag}
                logo={'logo' in item ? item.logo : undefined}
              ></NodeCard>
            </div>
          {/each}
        </div>
      </div>
    </div>

    <div class="lg:hidden space-y-6">
      <div>
        <div class="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
          {t.inputLabel}
        </div>
        <div class="space-y-2">
          {#each t.inputs as item}
            <NodeCard title={item.title} description={item.description} tag={item.tag}></NodeCard>
          {/each}
        </div>
      </div>
      <CenterDemo description={t.centerDescription}></CenterDemo>
      <div>
        <div class="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
          {t.monitoringLabel}
        </div>
        <div class="space-y-2">
          {#each t.monitoring as item}
            <NodeCard title={item.title} description={item.description} tag={item.tag}></NodeCard>
          {/each}
        </div>
      </div>
    </div>
  </div>
</section>
