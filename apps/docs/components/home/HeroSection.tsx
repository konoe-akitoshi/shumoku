import Link from 'next/link'
import { cn } from '@/lib/cn'
import { ArrowRightIcon, CopyIcon } from './icons'
import { backgrounds, buttonStyles, cardStyles } from './styles'

function StatusBadge() {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-medium mb-4 sm:mb-8 border border-emerald-500/20">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      900+ vendor icons
    </div>
  )
}

function HeroTitle() {
  return (
    <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-4 sm:mb-8 leading-[0.98]">
      <span className="text-neutral-900 dark:text-white">Network diagrams,</span>
      <br />
      <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 bg-clip-text text-transparent">
        as code.
      </span>
    </h1>
  )
}

function HeroDescription() {
  return (
    <p className="text-base sm:text-lg lg:text-xl text-neutral-700 dark:text-neutral-300 mb-6 sm:mb-10 leading-relaxed">
      YAML でネットワーク構成を定義し、美しい SVG ダイアグラムを自動生成。 Git
      でバージョン管理、CI/CD に統合。
    </p>
  )
}

function CTAButtons() {
  return (
    <div className="flex flex-wrap gap-3 mb-6 sm:mb-8">
      <Link href="/playground" className={cn(...buttonStyles.primary)}>
        Playground
        <ArrowRightIcon className="w-4 h-4" />
      </Link>
      <Link href="/docs" className={cn(...buttonStyles.secondary)}>
        Documentation
      </Link>
    </div>
  )
}

function InstallCommand() {
  return (
    <div className={cn(...cardStyles.install)}>
      <span className="text-neutral-500 select-none font-mono text-sm">$</span>
      <code className="font-mono text-sm text-neutral-200">npm install shumoku</code>
      <button
        type="button"
        className="text-neutral-500 hover:text-neutral-300 transition-colors"
        title="Copy"
      >
        <CopyIcon className="w-4 h-4" />
      </button>
    </div>
  )
}

function DiagramPreview() {
  return (
    <div className="relative order-last lg:order-none -mt-2 sm:-mt-6 lg:mt-0">
      <div className="relative mx-auto max-w-md sm:max-w-lg lg:max-w-none h-[68vw] sm:h-[60vw] lg:h-auto rounded-t-2xl lg:rounded-2xl rounded-b-none overflow-hidden bg-white dark:bg-neutral-900 border border-neutral-200/70 dark:border-neutral-800/70 shadow-2xl">
{/* biome-ignore lint/performance/noImgElement: SVG with responsive height */}
        <img
          src="/hero-diagram.svg"
          alt="Network diagram example"
          className="w-full h-full object-cover object-top lg:h-auto lg:object-contain"
        />
      </div>
    </div>
  )
}

export function HeroSection() {
  return (
    <section className="relative min-h-[85vh] lg:h-[85vh] lg:max-h-[900px] overflow-hidden">
      <div className="absolute inset-0 bg-white dark:bg-neutral-950 pointer-events-none" />
      <div className={cn('absolute inset-0 pointer-events-none', backgrounds.hero)} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 lg:pt-24">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr] lg:items-start lg:gap-14">
          <div className="order-first lg:order-none lg:pl-8 lg:pt-6">
            <div className="mx-auto max-w-md sm:max-w-lg lg:max-w-2xl lg:mx-0">
              <StatusBadge />
              <HeroTitle />
              <HeroDescription />
              <CTAButtons />
              <InstallCommand />
            </div>
          </div>
          <DiagramPreview />
        </div>
      </div>
    </section>
  )
}
