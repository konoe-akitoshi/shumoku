import { cn } from '@/lib/cn'
import { sectionStyles } from './styles'
import { homeTranslations, type Locale } from './translations'

export function ForTeamsSection({ locale }: { locale: string }) {
  const t = homeTranslations[locale as Locale]?.forTeams ?? homeTranslations.en.forTeams

  return (
    <section className={cn('relative overflow-hidden', sectionStyles.padding)}>
      <div className="max-w-5xl mx-auto">
        <h2 className={cn(sectionStyles.title, 'text-center mb-8 sm:mb-12')}>{t.title}</h2>

        {/* Services + Roadmap */}
        <div className="flex flex-wrap justify-center gap-3 mb-4">
          {t.services.map((service) => (
            <span
              key={service}
              className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white/80 dark:bg-neutral-800/60 text-sm text-neutral-700 dark:text-neutral-300"
            >
              {service}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-2 mb-10 sm:mb-14">
          <span className="text-xs text-neutral-500">{t.roadmapLabel}:</span>
          {t.roadmap.map((item) => (
            <span
              key={item}
              className="px-2.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-xs text-neutral-500 dark:text-neutral-500 border border-neutral-200/70 dark:border-neutral-700/50"
            >
              {item}
            </span>
          ))}
        </div>

        {/* Early Adopters */}
        <h3 className="text-sm font-semibold text-center text-neutral-500 uppercase tracking-wider mb-6">
          {t.adopters.title}
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          {t.adopters.items.map((item) => (
            <div
              key={item.attribution}
              className="rounded-xl border border-neutral-200/70 dark:border-neutral-700/50 p-5 bg-white/90 dark:bg-neutral-800/60"
            >
              <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-3 leading-relaxed">
                &ldquo;{item.quote}&rdquo;
              </p>
              <p className="text-xs text-neutral-500">{item.attribution}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
