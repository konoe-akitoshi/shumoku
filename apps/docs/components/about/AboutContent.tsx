import { cn } from '@/lib/cn'
import { backgrounds, sectionStyles } from '../home/styles'
import { type AboutLocale, aboutTranslations } from './translations'

export function AboutContent({ locale }: { locale: string }) {
  const t = aboutTranslations[locale as AboutLocale] ?? aboutTranslations.en

  return (
    <>
      {/* Hero */}
      <section
        id="about"
        className={cn('relative overflow-hidden scroll-mt-20', sectionStyles.padding)}
      >
        <div className={cn('absolute inset-0 pointer-events-none', backgrounds.hero)} />
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className={cn(sectionStyles.title, 'mb-4')}>{t.title}</h2>
          <p className={sectionStyles.subtitle}>{t.lead}</p>
        </div>
      </section>

      {/* Name origin */}
      <section className={cn('relative', sectionStyles.padding)}>
        <div className="max-w-3xl mx-auto">
          <h2 className={cn(sectionStyles.title, 'text-xl sm:text-2xl md:text-3xl mb-6')}>
            {t.name.heading}
          </h2>
          <div className="space-y-4">
            {t.name.paragraphs.map((p) => (
              <p
                key={p.slice(0, 24)}
                className="text-sm sm:text-base leading-relaxed text-neutral-700 dark:text-neutral-300"
              >
                {p}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* Logo origin */}
      <section className={cn('relative', sectionStyles.padding)}>
        <div className="max-w-3xl mx-auto">
          <h2 className={cn(sectionStyles.title, 'text-xl sm:text-2xl md:text-3xl mb-6')}>
            {t.logo.heading}
          </h2>
          <div className="space-y-4">
            {t.logo.paragraphs.map((p) => (
              <p
                key={p.slice(0, 24)}
                className="text-sm sm:text-base leading-relaxed text-neutral-700 dark:text-neutral-300"
              >
                {p}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section className={cn('relative overflow-hidden', sectionStyles.padding)}>
        <div className={cn('absolute inset-0 pointer-events-none', backgrounds.features)} />
        <div className="relative max-w-4xl mx-auto">
          <h2 className={cn(sectionStyles.title, 'text-xl sm:text-2xl md:text-3xl mb-6')}>
            {t.philosophy.heading}
          </h2>

          <blockquote className="border-l-2 border-emerald-500 pl-4 mb-8">
            <p className="text-base sm:text-lg font-semibold">{t.philosophy.quote}</p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              {t.philosophy.quoteEn}
            </p>
          </blockquote>

          <div className="space-y-4 mb-10">
            {t.philosophy.paragraphs.map((p) => (
              <p
                key={p.slice(0, 24)}
                className="text-sm sm:text-base leading-relaxed text-neutral-700 dark:text-neutral-300"
              >
                {p}
              </p>
            ))}
          </div>

          {/* Three conditions */}
          <div className="grid sm:grid-cols-3 gap-4 mb-10">
            {t.philosophy.conditions.map((c) => (
              <div
                key={c.title}
                className="rounded-2xl border border-neutral-200/70 dark:border-neutral-700/50 bg-white/90 dark:bg-neutral-800/60 p-5"
              >
                <h3 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-1.5">
                  {c.title}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-500">{c.description}</p>
              </div>
            ))}
          </div>

          {/* Three layers */}
          <div className="grid sm:grid-cols-3 gap-4 mb-10">
            {t.philosophy.layers.map((layer) => (
              <div
                key={layer.title}
                className="rounded-2xl border border-neutral-200/70 dark:border-neutral-700/50 bg-white/90 dark:bg-neutral-800/60 p-5"
              >
                <h3 className="text-sm font-semibold mb-1.5">{layer.title}</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-500">
                  {layer.description}
                </p>
              </div>
            ))}
          </div>

          {/* Six principles */}
          <h3 className="text-sm font-semibold mb-4">{t.philosophy.principlesHeading}</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {t.philosophy.principles.map((p) => (
              <div
                key={p.title}
                className="flex items-start gap-3 rounded-xl border border-neutral-200/70 dark:border-neutral-700/50 bg-white/70 dark:bg-neutral-800/40 p-4"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <div>
                  <div className="text-sm font-semibold">{p.title}</div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-500">
                    {p.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Full-text links */}
      <section className={cn('relative', sectionStyles.padding)}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-4">
            {t.sources.heading}
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://github.com/konoe-akitoshi/shumoku/blob/main/docs/ORIGIN.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm text-neutral-600 dark:text-neutral-400 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
            >
              {t.sources.origin}
            </a>
            <a
              href="https://github.com/konoe-akitoshi/shumoku/blob/main/docs/PHILOSOPHY.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm text-neutral-600 dark:text-neutral-400 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
            >
              {t.sources.philosophy}
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
