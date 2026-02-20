import Link from 'next/link'
import { cn } from '@/lib/cn'
import { ArrowRightIcon } from './icons'
import { buttonStyles, sectionStyles } from './styles'
import { homeTranslations, type Locale } from './translations'

export function GettingStartedSection({ locale }: { locale: string }) {
  const t =
    homeTranslations[locale as Locale]?.gettingStarted ?? homeTranslations.en.gettingStarted

  return (
    <section className={cn('relative overflow-hidden', sectionStyles.padding)}>
      <div className="max-w-5xl mx-auto">
        <h2 className={cn(sectionStyles.title, 'text-center mb-8 sm:mb-12')}>{t.title}</h2>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Community */}
          <div className="rounded-2xl border border-neutral-200/70 dark:border-neutral-700/50 p-6 bg-white/90 dark:bg-neutral-800/60">
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-4">
              {t.community.label}
            </div>
            <div className="space-y-2 mb-6">
              {t.community.steps.map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-neutral-100 dark:bg-neutral-700 text-[10px] font-medium flex items-center justify-center text-neutral-500 shrink-0">
                    {i + 1}
                  </span>
                  <code className="text-sm text-neutral-700 dark:text-neutral-300">{step}</code>
                </div>
              ))}
            </div>
            <Link
              href={`/${locale}/docs/server`}
              className={cn(...buttonStyles.secondary, 'text-sm')}
            >
              {t.community.cta}
            </Link>
          </div>

          {/* Production */}
          <div className="rounded-2xl border border-emerald-300/50 dark:border-emerald-700/50 p-6 bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-950/20 dark:to-transparent">
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-4">
              {t.production.label}
            </div>
            <ul className="space-y-2.5 mb-6">
              {t.production.items.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                  <svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
            <a href="mailto:info@shumoku.dev" className={cn(...buttonStyles.primary, 'text-sm')}>
              {t.production.cta}
              <ArrowRightIcon className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
