import { cn } from '@/lib/cn'
import { sectionStyles } from './styles'
import { homeTranslations, type Locale } from './translations'

function NodeCard({
  title,
  description,
  tag,
}: {
  title: string
  description: string
  tag?: string
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-neutral-200/70 dark:border-neutral-700/50 bg-white/90 dark:bg-neutral-800/60">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{title}</span>
          {tag && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400">
              {tag}
            </span>
          )}
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-0.5">{description}</p>
      </div>
    </div>
  )
}

function CenterNode() {
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
        <img src="/logo-symbol.svg" alt="Shumoku" className="w-12 h-12 sm:w-14 sm:h-14" />
      </div>
      <span className="text-xs font-semibold mt-2 text-neutral-700 dark:text-neutral-300">
        Shumoku
      </span>
    </div>
  )
}

function Arrow({ direction }: { direction: 'right' | 'left' }) {
  return (
    <div className="hidden lg:flex items-center px-1">
      <div className="w-8 h-px bg-neutral-300 dark:bg-neutral-600 relative">
        {direction === 'right' && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-[5px] border-l-neutral-300 dark:border-l-neutral-600 border-y-[4px] border-y-transparent" />
        )}
        {direction === 'left' && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0 h-0 border-r-[5px] border-r-neutral-300 dark:border-r-neutral-600 border-y-[4px] border-y-transparent" />
        )}
      </div>
    </div>
  )
}

export function IntegrationsSection({ locale }: { locale: string }) {
  const t = homeTranslations[locale as Locale]?.integrations ?? homeTranslations.en.integrations

  return (
    <section className={cn('relative overflow-hidden', sectionStyles.padding)}>
      <div className="max-w-5xl mx-auto">
        <h2 className={cn(sectionStyles.title, 'text-center mb-8 sm:mb-12')}>{t.title}</h2>

        {/* Desktop: 3-column flow diagram */}
        <div className="hidden lg:grid lg:grid-cols-[1fr_auto_1fr] gap-4 items-center">
          {/* Left: Input sources */}
          <div>
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3 text-right">
              {t.inputLabel}
            </div>
            <div className="space-y-3">
              {t.inputs.map((item) => (
                <div key={item.title} className="flex items-center gap-2 justify-end">
                  <NodeCard title={item.title} description={item.description} tag={item.tag} />
                  <Arrow direction="right" />
                </div>
              ))}
            </div>
          </div>

          {/* Center: Shumoku */}
          <CenterNode />

          {/* Right: Monitoring sources */}
          <div>
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
              {t.monitoringLabel}
            </div>
            <div className="space-y-3">
              {t.monitoring.map((item) => (
                <div key={item.title} className="flex items-center gap-2">
                  <Arrow direction="left" />
                  <NodeCard title={item.title} description={item.description} tag={item.tag} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile: stacked layout */}
        <div className="lg:hidden space-y-6">
          <div>
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
              {t.inputLabel}
            </div>
            <div className="space-y-2">
              {t.inputs.map((item) => (
                <NodeCard key={item.title} title={item.title} description={item.description} tag={item.tag} />
              ))}
            </div>
          </div>

          <div className="flex justify-center">
            <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
            </svg>
          </div>

          <div className="flex justify-center">
            <CenterNode />
          </div>

          <div className="flex justify-center">
            <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
            </svg>
          </div>

          <div>
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
              {t.monitoringLabel}
            </div>
            <div className="space-y-2">
              {t.monitoring.map((item) => (
                <NodeCard key={item.title} title={item.title} description={item.description} tag={item.tag} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
