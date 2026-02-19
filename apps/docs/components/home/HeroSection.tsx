import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/cn'
import { ArrowRightIcon } from './icons'
import { backgrounds, buttonStyles } from './styles'
import { type HeroTranslations, homeTranslations, type Locale } from './translations'

type Adopter = {
  name: string
  logo: string
  url?: string
}

const adopters: Adopter[] = [
  {
    name: '電気通信大学 情報基盤センター',
    logo: '/adopters/itcuec_logo_300.png',
    url: 'https://www.cc.uec.ac.jp/',
  },
  {
    name: 'JANOG57',
    logo: '/adopters/janog57_logo.svg',
    url: 'https://www.janog.gr.jp/meeting/janog57/',
  },
]

function StatusBadge({ t }: { t: HeroTranslations }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-medium mb-4 sm:mb-8 border border-emerald-500/20">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      {t.badge}
    </div>
  )
}

function HeroTitle({ t }: { t: HeroTranslations }) {
  return (
    <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-4 sm:mb-8 leading-[0.98]">
      <span className="text-neutral-900 dark:text-white">{t.title1}</span>
      <br />
      <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 bg-clip-text text-transparent">
        {t.title2}
      </span>
    </h1>
  )
}

function HeroDescription({ t }: { t: HeroTranslations }) {
  return (
    <p className="text-base sm:text-lg lg:text-xl text-neutral-700 dark:text-neutral-300 mb-6 sm:mb-10 leading-relaxed">
      {t.description}
    </p>
  )
}

function CTAButtons({ t, locale }: { t: HeroTranslations; locale: string }) {
  return (
    <div className="flex flex-wrap gap-3 mb-6 sm:mb-8">
      <Link href={`/${locale}/playground`} className={cn(...buttonStyles.primary)}>
        {t.playground}
        <ArrowRightIcon className="w-4 h-4" />
      </Link>
      <Link href={`/${locale}/docs/server`} className={cn(...buttonStyles.secondary)}>
        {t.documentation}
      </Link>
    </div>
  )
}

function NpmDocsLink({ t, locale }: { t: HeroTranslations; locale: string }) {
  return (
    <p className="text-sm text-neutral-600 dark:text-neutral-400">
      {t.npmDocsPrefix}{' '}
      <Link
        href={`/${locale}/docs/npm`}
        className="text-neutral-900 dark:text-neutral-200 underline-offset-4 hover:underline"
      >
        {t.npmDocsLink}
      </Link>
    </p>
  )
}

function DiagramPreview() {
  return (
    <div className="mt-8 sm:mt-10 lg:mt-0 lg:flex-1 flex items-center">
      <div className="rounded-2xl overflow-hidden border border-neutral-200/70 dark:border-neutral-800/70 shadow-2xl">
        <img
          src="/screenshots/topology.png"
          alt="Topology viewer with live weathermap"
          className="w-full h-auto"
        />
      </div>
    </div>
  )
}

function Adopters({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
        {label}
      </span>
      <div className="flex items-center gap-8">
        {adopters.map((adopter) =>
          adopter.url ? (
            <a
              key={adopter.name}
              href={adopter.url}
              target="_blank"
              rel="noopener noreferrer"
              title={adopter.name}
            >
              <Image
                src={adopter.logo}
                alt={adopter.name}
                width={180}
                height={54}
                className="h-10 sm:h-12 w-auto object-contain opacity-70 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-300"
              />
            </a>
          ) : (
            <Image
              key={adopter.name}
              src={adopter.logo}
              alt={adopter.name}
              width={180}
              height={54}
              className="h-10 sm:h-12 w-auto object-contain opacity-70 grayscale"
            />
          ),
        )}
      </div>
    </div>
  )
}

export function HeroSection({ locale }: { locale: string }) {
  const t = homeTranslations[locale as Locale]?.hero ?? homeTranslations.en.hero
  const adoptersLabel =
    homeTranslations[locale as Locale]?.adopters?.title ?? homeTranslations.en.adopters.title

  return (
    <section className="relative">
      <div className="absolute inset-0 bg-white dark:bg-neutral-950 pointer-events-none" />
      <div className={cn('absolute inset-0 pointer-events-none', backgrounds.hero)} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <div className="grid lg:grid-cols-2 lg:items-stretch gap-8 lg:gap-12 mb-12 lg:mb-16">
          {/* Left: Text content */}
          <div className="max-w-xl">
            {t.badge ? <StatusBadge t={t} /> : null}
            <HeroTitle t={t} />
            <HeroDescription t={t} />
            <CTAButtons t={t} locale={locale} />
            <NpmDocsLink t={t} locale={locale} />
          </div>

          {/* Right: Diagram */}
          <div className="flex flex-col">
            <DiagramPreview />
          </div>
        </div>

        {/* Adopters */}
        <Adopters label={adoptersLabel} />
      </div>
    </section>
  )
}
