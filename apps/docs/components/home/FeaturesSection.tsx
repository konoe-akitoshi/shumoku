import { cn } from '@/lib/cn'
import { featureIcons } from './features-data'
import { backgrounds, cardStyles, sectionStyles } from './styles'
import { homeTranslations, type Locale } from './translations'

export function FeaturesSection({ locale }: { locale: string }) {
  const t = homeTranslations[locale as Locale]?.features ?? homeTranslations.en.features

  return (
    <section className={cn('relative overflow-hidden', sectionStyles.padding)}>
      <div className={cn('absolute inset-0 pointer-events-none', backgrounds.features)} />

      <div className="max-w-6xl mx-auto">
        <h2 className={cn(sectionStyles.title, 'text-center mb-8 sm:mb-12')}>{t.title}</h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {t.items.map((feature, index) => (
            <div key={feature.title} className={cn(...cardStyles.feature)}>
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#7FE4C1]/40 to-transparent dark:from-[#7FE4C1]/20 dark:to-transparent text-[#1F2328] dark:text-[#7FE4C1] flex items-center justify-center mb-3">
                {featureIcons[index]}
              </div>
              <h3 className="text-base font-semibold mb-1">{feature.title}</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
