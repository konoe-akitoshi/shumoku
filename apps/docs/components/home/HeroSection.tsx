import Link from 'next/link'
import { cn } from '@/lib/cn'
import { ArrowRightIcon, GitHubIcon } from './icons'
import { backgrounds, buttonStyles } from './styles'
import { homeTranslations, type Locale } from './translations'

export function HeroSection({ locale }: { locale: string }) {
  const t = homeTranslations[locale as Locale]?.hero ?? homeTranslations.en.hero

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-white dark:bg-neutral-950 pointer-events-none" />
      <div className={cn('absolute inset-0 pointer-events-none', backgrounds.hero)} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:pl-8 lg:pr-0 pt-12 pb-8 sm:pt-16 sm:pb-10 lg:pt-20 lg:pb-12">
        <div className="grid lg:grid-cols-[5fr_7fr] lg:items-center gap-8 lg:gap-12">
          <div className="order-2 lg:order-none">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[0.98]">
              <span className="text-neutral-900 dark:text-white">{t.title1}</span>
              <br />
              <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 bg-clip-text text-transparent whitespace-nowrap">
                {t.title2}
              </span>
            </h1>

            <p className="text-base sm:text-lg text-neutral-600 dark:text-neutral-400 mt-4 sm:mt-5 leading-relaxed">
              {t.description1}
              <br />
              {t.description2}
            </p>

            <div className="flex flex-wrap items-center gap-3 mt-6 sm:mt-7">
              <Link href={`/${locale}/docs/server`} className={cn(...buttonStyles.primary)}>
                {t.deploy}
                <ArrowRightIcon className="w-4 h-4" />
              </Link>
              <a href="mailto:info@shumoku.dev" className={cn(...buttonStyles.secondary)}>
                {t.demo}
              </a>
              <a
                href="https://github.com/konoe-akitoshi/shumoku"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300 transition-colors"
              >
                <GitHubIcon className="w-4 h-4" />
                {t.githubLabel}
              </a>
            </div>
          </div>

          <div className="order-1 lg:order-none rounded-2xl lg:rounded-r-none overflow-hidden border border-neutral-200/70 dark:border-neutral-800/70 lg:border-r-0 shadow-2xl lg:-mr-[10vw]">
            <img
              src="/screenshots/topology.png"
              alt="Topology viewer with live weathermap"
              className="w-full h-auto"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
