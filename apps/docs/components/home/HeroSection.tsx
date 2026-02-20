import Link from 'next/link'
import { cn } from '@/lib/cn'
import { ArrowRightIcon, GitHubIcon } from './icons'
import { backgrounds, buttonStyles } from './styles'
import { homeTranslations, type Locale } from './translations'

export function HeroSection({ locale }: { locale: string }) {
  const t = homeTranslations[locale as Locale]?.hero ?? homeTranslations.en.hero

  return (
    <section className="relative">
      <div className="absolute inset-0 bg-white dark:bg-neutral-950 pointer-events-none" />
      <div className={cn('absolute inset-0 pointer-events-none', backgrounds.hero)} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <div className="grid lg:grid-cols-2 lg:items-stretch gap-8 lg:gap-12">
          <div className="max-w-xl">
            {/* Small label */}
            <span className="inline-block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-4">
              {t.label}
            </span>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-4 sm:mb-6 leading-[0.98]">
              <span className="text-neutral-900 dark:text-white">{t.title1}</span>
              <br />
              <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 bg-clip-text text-transparent">
                {t.title2}
              </span>
            </h1>

            {/* Sub copy — 2 lines */}
            <p className="text-base sm:text-lg text-neutral-600 dark:text-neutral-400 mb-6 sm:mb-8 leading-relaxed">
              {t.description1}
              <br />
              {t.description2}
            </p>

            {/* CTA */}
            <div className="flex flex-wrap items-center gap-3">
              <Link href={`/${locale}/docs/server`} className={cn(...buttonStyles.primary)}>
                {t.deploy}
                <ArrowRightIcon className="w-4 h-4" />
              </Link>
              <a href="mailto:info@shumoku.dev" className={cn(...buttonStyles.secondary)}>
                {t.talkToUs}
              </a>
              <a
                href="https://github.com/konoe-akitoshi/shumoku"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300 transition-colors ml-1"
              >
                <GitHubIcon className="w-4 h-4" />
                {t.githubLabel}
              </a>
            </div>
          </div>

          {/* Visual */}
          <div className="mt-4 lg:mt-0 lg:flex-1 flex items-center">
            <div className="rounded-2xl overflow-hidden border border-neutral-200/70 dark:border-neutral-800/70 shadow-2xl">
              <img
                src="/screenshots/topology.png"
                alt="Topology viewer with live weathermap"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
