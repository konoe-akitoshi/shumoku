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
    <div className="relative flex-1 mt-8 sm:mt-10 lg:mt-0">
      <div className="absolute inset-0 rounded-2xl overflow-hidden bg-white dark:bg-neutral-900 border border-neutral-200/70 dark:border-neutral-800/70">
        <img
          src="/hero-diagram.svg"
          alt="Network diagram example"
          className="w-full h-full object-cover object-top"
        />
        {/* 下部グラデーション */}
        <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-white dark:from-neutral-900 to-transparent pointer-events-none" />
      </div>
    </div>
  )
}

export function HeroSection() {
  return (
    <section className="relative">
      <div className="absolute inset-0 bg-white dark:bg-neutral-950 pointer-events-none" />
      <div className={cn('absolute inset-0 pointer-events-none', backgrounds.hero)} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 lg:items-stretch gap-12 lg:gap-16">
          {/* 左: テキストコンテンツ */}
          <div className="max-w-xl">
            <StatusBadge />
            <HeroTitle />
            <HeroDescription />
            <CTAButtons />
            <InstallCommand />
          </div>

          {/* 右: ダイアグラム */}
          <div className="flex flex-col">
            <DiagramPreview />
          </div>
        </div>
      </div>
    </section>
  )
}
