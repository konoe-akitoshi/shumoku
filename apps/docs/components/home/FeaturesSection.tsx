import { cn } from '@/lib/cn'
import { featureIcons } from './features-data'
import { backgrounds, cardStyles, sectionStyles } from './styles'
import { homeTranslations, type Locale } from './translations'

type FeatureItem = {
  title: string
  description: string
}

function FeatureCard({ feature, icon }: { feature: FeatureItem; icon: React.ReactNode }) {
  return (
    <div className={cn(...cardStyles.feature)}>
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#7FE4C1]/40 to-transparent dark:from-[#7FE4C1]/20 dark:to-transparent text-[#1F2328] dark:text-[#7FE4C1] flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
      <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed">
        {feature.description}
      </p>
    </div>
  )
}

export function FeaturesSection({ locale }: { locale: string }) {
  const t = homeTranslations[locale as Locale]?.features ?? homeTranslations.en.features

  return (
    <section
      className={cn(
        'relative overflow-hidden',
        sectionStyles.padding,
      )}
    >
      <div className={cn('absolute inset-0 pointer-events-none', backgrounds.features)} />

      <div className="max-w-6xl mx-auto">
        <h2 className={cn(sectionStyles.title, 'text-center mb-3 sm:mb-4')}>{t.title}</h2>
        <p
          className={cn(
            sectionStyles.subtitle,
            'text-center mb-8 sm:mb-12 lg:mb-16 max-w-2xl mx-auto',
          )}
        >
          {t.subtitle}
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {t.items.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} icon={featureIcons[index]} />
          ))}
        </div>
      </div>
    </section>
  )
}
