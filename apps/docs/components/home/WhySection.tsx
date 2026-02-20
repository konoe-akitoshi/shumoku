import { cn } from '@/lib/cn'
import { sectionStyles } from './styles'
import { homeTranslations, type Locale } from './translations'

export function WhySection({ locale }: { locale: string }) {
  const t = homeTranslations[locale as Locale]?.why ?? homeTranslations.en.why

  return (
    <section className={cn('relative overflow-hidden', sectionStyles.padding)}>
      <div className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-[1fr_auto_1fr] gap-6 md:gap-4 items-stretch">
          {/* Problem */}
          <div className="rounded-2xl border border-red-200/70 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/10 p-6">
            <div className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider mb-4">
              {t.problem.title}
            </div>
            <ul className="space-y-3">
              {t.problem.items.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-neutral-700 dark:text-neutral-300">
                  <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 px-2">
              {/* Horizontal arrow on md+, vertical on mobile */}
              <svg className="hidden md:block w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <svg className="md:hidden w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
              </svg>
              <p className="text-xs text-neutral-500 dark:text-neutral-500 text-center max-w-[140px] leading-tight hidden md:block">
                {t.arrow}
              </p>
            </div>
          </div>

          {/* Solution */}
          <div className="rounded-2xl border border-emerald-200/70 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/10 p-6">
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-4">
              {t.solution.title}
            </div>
            <ul className="space-y-3">
              {t.solution.items.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-neutral-700 dark:text-neutral-300">
                  <svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Mobile arrow caption */}
        <p className="md:hidden text-xs text-neutral-500 text-center mt-2">{t.arrow}</p>
      </div>
    </section>
  )
}
