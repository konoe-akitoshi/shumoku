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
          {/* Open Source */}
          <div className="rounded-2xl border border-neutral-200/70 dark:border-neutral-700/50 bg-white/90 dark:bg-neutral-800/60 flex flex-col">
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-neutral-200/70 dark:border-neutral-700/50">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400/60 dark:bg-red-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60 dark:bg-yellow-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400/60 dark:bg-green-500/70" />
              </div>
              <span className="text-xs text-neutral-500 dark:text-neutral-500 ml-1.5">
                {t.community.label}
              </span>
            </div>
            <div className="px-5 pt-5 space-y-2.5 flex-1">
              {t.community.steps.map((step, i) => {
                const isCommand = /^[a-z]/.test(step)
                return (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="text-emerald-600 dark:text-emerald-400 shrink-0 select-none font-mono text-sm mt-px">
                      {isCommand ? '$' : '→'}
                    </span>
                    <span className={cn('text-sm', isCommand ? 'font-mono text-neutral-700 dark:text-neutral-300' : 'text-neutral-600 dark:text-neutral-400')}>
                      {step}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="px-5 pb-5 pt-5">
              <Link
                href={`/${locale}/docs/server`}
                className={cn(...buttonStyles.secondary, 'text-sm')}
              >
                {t.community.cta}
                <ArrowRightIcon className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Enterprise */}
          <div className="rounded-2xl border border-emerald-300/50 dark:border-emerald-700/50 bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-950/20 dark:to-transparent flex flex-col">
            <div className="px-6 pt-6 mb-5">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                {t.production.label}
              </span>
            </div>
            <ul className="px-6 space-y-2.5 flex-1">
              {t.production.items.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-neutral-700 dark:text-neutral-300">
                  <svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
            <div className="px-6 pb-6 pt-5">
              <a href="mailto:info@shumoku.dev" className={cn(...buttonStyles.primary, 'text-sm')}>
                {t.production.cta}
                <ArrowRightIcon className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
