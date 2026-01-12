import Link from 'next/link'
import { cn } from '@/lib/cn'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  openGraph: {
    images: '/og',
  },
}

export default function HomePage() {
  return (
    <main className="flex-1">
      {/* Hero Section */}
      <section className="relative min-h-[85vh] lg:h-[85vh] lg:max-h-[900px] overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-white dark:bg-neutral-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_80%_at_60%_-30%,rgba(127,228,193,0.3),transparent)] dark:bg-[radial-gradient(ellipse_100%_80%_at_60%_-30%,rgba(127,228,193,0.15),transparent)]" />

        {/* Content container with frame */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 lg:pt-24">
          {/* Decorative frame lines - Desktop only */}
          <div className="absolute inset-0 hidden lg:block pointer-events-none">
            {/* Left vertical line */}
            <div
              className="absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-neutral-300 via-neutral-300 to-transparent dark:from-neutral-700 dark:via-neutral-700"
            />
            {/* Top horizontal line */}
            <div
              className="absolute left-4 right-0 top-0 h-px bg-gradient-to-r from-neutral-300 via-neutral-200 to-transparent dark:from-neutral-700 dark:via-neutral-800"
            />
          </div>

          {/* Text content */}
          <div className="lg:pl-8 lg:pt-8">
            <div className="max-w-2xl lg:max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-medium mb-4 sm:mb-8 border border-emerald-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              900+ vendor icons
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-4 sm:mb-8">
              <span className="text-neutral-900 dark:text-white">Network diagrams,</span>
              <br />
              <span className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 bg-clip-text text-transparent">
                as code.
              </span>
            </h1>

            <p className="text-base sm:text-lg lg:text-xl text-neutral-600 dark:text-neutral-400 mb-6 sm:mb-10 leading-relaxed">
              YAML でネットワーク構成を定義し、美しい SVG ダイアグラムを自動生成。
              Git でバージョン管理、CI/CD に統合。
            </p>

            <div className="flex flex-wrap gap-3 mb-6 sm:mb-8">
              <Link
                href="/playground"
                className={cn(
                  'inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-base',
                  'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900',
                  'hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors',
                  'shadow-lg'
                )}
              >
                Playground
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <Link
                href="/docs"
                className={cn(
                  'inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-base',
                  'bg-neutral-100 dark:bg-neutral-800',
                  'text-neutral-700 dark:text-neutral-300',
                  'hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors'
                )}
              >
                Documentation
              </Link>
            </div>

            {/* Install command */}
            <div className={cn(
              'inline-flex items-center gap-3 px-4 py-2.5 rounded-lg',
              'bg-neutral-900 dark:bg-neutral-800',
              'border border-neutral-800 dark:border-neutral-700'
            )}>
              <span className="text-neutral-500 select-none font-mono text-sm">$</span>
              <code className="font-mono text-sm text-neutral-200">npm install shumoku</code>
              <button
                className="text-neutral-500 hover:text-neutral-300 transition-colors"
                title="Copy"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        </div>

        {/* Diagram - Desktop: positioned behind text for layered effect */}
        <div
          className="absolute top-[12%] right-0 lg:right-[max(0rem,calc((100vw-84rem)/2))] hidden lg:block"
          style={{
            maskImage: 'linear-gradient(to right, transparent 0%, black 35%)',
            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 35%)',
          }}
        >
          <div
            className={cn(
              'w-[720px] rounded-xl overflow-hidden',
              'bg-white dark:bg-neutral-900',
              'border border-neutral-200 dark:border-neutral-800',
              'shadow-2xl'
            )}
          >
            <img
              src="/hero-diagram.svg"
              alt="Network diagram example"
              className="w-full h-auto"
            />
          </div>
        </div>

        {/* Diagram - Mobile: below text content */}
        <div className="relative lg:hidden px-4 sm:px-6 mt-8 sm:mt-12 pb-8 sm:pb-12">
          <div
            className={cn(
              'w-full max-w-md mx-auto rounded-xl overflow-hidden',
              'bg-white dark:bg-neutral-900',
              'border border-neutral-200 dark:border-neutral-800',
              'shadow-xl'
            )}
          >
            <div className="h-[280px] sm:h-[350px] overflow-hidden">
              <img
                src="/hero-diagram.svg"
                alt="Network diagram example"
                className="w-full h-auto object-top"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-12 sm:py-16 lg:py-20 px-4 sm:px-6 bg-neutral-50 dark:bg-neutral-900/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-3 sm:mb-4">
            Why Shumoku?
          </h2>
          <p className="text-base sm:text-lg text-neutral-600 dark:text-neutral-400 text-center mb-8 sm:mb-12 lg:mb-16 max-w-2xl mx-auto">
            ネットワークエンジニアのためのモダンなダイアグラムツール
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[
              {
                title: 'YAML で定義',
                description: 'シンプルで読みやすい YAML 記法。Git で管理、レビューも簡単',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                ),
              },
              {
                title: '900+ ベンダーアイコン',
                description: 'Yamaha, Aruba, AWS, Juniper など主要ベンダーに対応',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ),
              },
              {
                title: '自動レイアウト',
                description: 'ELK.js による階層的な自動レイアウト。手動配置不要',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                  </svg>
                ),
              },
              {
                title: 'SVG エクスポート',
                description: '高品質なベクター形式。ズームしても綺麗',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                ),
              },
              {
                title: 'TypeScript',
                description: '完全な型安全性。IDE での補完も完璧',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                ),
              },
              {
                title: 'NetBox 連携',
                description: 'NetBox から自動でダイアグラム生成',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ),
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className={cn(
                  'p-6 rounded-2xl',
                  'bg-white dark:bg-neutral-800/50',
                  'border border-neutral-200 dark:border-neutral-700/50',
                  'hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors'
                )}
              >
                <div className="w-12 h-12 rounded-xl bg-[#7FE4C1]/20 dark:bg-[#7FE4C1]/10 text-[#1F2328] dark:text-[#7FE4C1] flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
            Ready to get started?
          </h2>
          <p className="text-base sm:text-lg text-neutral-600 dark:text-neutral-400 mb-6 sm:mb-10">
            Playground で試すか、ドキュメントを読んでみてください
          </p>
          <div className="flex flex-wrap gap-3 sm:gap-4 justify-center">
            <Link
              href="/playground"
              className={cn(
                'inline-flex items-center gap-2 px-6 py-3 sm:px-8 sm:py-4 rounded-xl font-semibold',
                'bg-[#7FE4C1] text-[#1F2328]',
                'hover:bg-[#6dd4b1] transition-colors'
              )}
            >
              Try Playground
            </Link>
            <a
              href="https://github.com/konoe-akitoshi/shumoku"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'inline-flex items-center gap-2 px-6 py-3 sm:px-8 sm:py-4 rounded-xl font-semibold',
                'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300',
                'border border-neutral-200 dark:border-neutral-700',
                'hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors'
              )}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
              GitHub
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}
