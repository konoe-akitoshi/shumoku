import { Check, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { sectionStyles } from './styles'
import { homeTranslations, type Locale } from './translations'

export function WhySection({ locale }: { locale: string }) {
  const t = homeTranslations[locale as Locale]?.why ?? homeTranslations.en.why

  return (
    <section className={cn('relative overflow-hidden', sectionStyles.padding)}>
      <div className="max-w-2xl mx-auto">
        {/* Problems */}
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 text-center mb-5">
          {t.problem.title}
        </p>
        <ul className="w-fit max-w-full mx-auto space-y-3">
          {t.problem.items.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2.5 text-sm sm:text-base text-neutral-500 dark:text-neutral-400"
            >
              <X
                className="w-4 h-4 mt-0.5 sm:mt-1 shrink-0 text-neutral-400 dark:text-neutral-600"
                aria-hidden="true"
              />
              {item}
            </li>
          ))}
        </ul>

        {/* Turn */}
        <div className="flex justify-center my-8 sm:my-10" aria-hidden="true">
          <div className="w-px h-10 bg-neutral-300 dark:bg-neutral-700" />
        </div>

        {/* Claim */}
        <p className="text-balance [word-break:auto-phrase] text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white text-center leading-snug mb-8 sm:mb-10">
          {t.arrow}
        </p>

        {/* Solutions */}
        <ul className="w-fit max-w-full mx-auto space-y-3">
          {t.solution.items.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2.5 text-sm sm:text-base text-neutral-800 dark:text-neutral-200"
            >
              <Check
                className="w-4 h-4 mt-0.5 sm:mt-1 shrink-0 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
