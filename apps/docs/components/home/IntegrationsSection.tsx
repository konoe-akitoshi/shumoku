import { FileCode2, Plug } from 'lucide-react'
import { cn } from '@/lib/cn'
import { sectionStyles } from './styles'
import { homeTranslations, type Locale } from './translations'

const builtinIcons: Record<string, React.ReactNode> = {
  YAML: <FileCode2 className="w-7 h-7 shrink-0 text-neutral-500 dark:text-neutral-400" />,
  'Custom API': <Plug className="w-7 h-7 shrink-0 text-neutral-500 dark:text-neutral-400" />,
}

function NodeCard({
  title,
  description,
  tag,
  logo,
}: {
  title: string
  description: string
  tag?: string
  logo?: string
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-neutral-200/70 dark:border-neutral-700/50 bg-white/90 dark:bg-neutral-800/60 w-full">
      {logo ? (
        <img src={logo} alt={title} className="w-7 h-7 shrink-0 object-contain" />
      ) : (
        builtinIcons[title] ?? null
      )}
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

function CenterDemo({ description }: { description: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200/70 dark:border-neutral-700/50 bg-white/90 dark:bg-neutral-800/60">
      <div className="px-2.5 pt-2.5">
        <div className="rounded-lg overflow-hidden border border-neutral-100 dark:border-neutral-700/30">
          <video
            autoPlay
            muted
            loop
            playsInline
            src="/screenshots/demo.mp4"
            className="w-full h-auto"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 py-3">
        <img src="/logo-symbol.svg" alt="Shumoku" className="w-7 h-7 shrink-0" />
        <div>
          <span className="text-sm font-semibold">Shumoku</span>
          <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-0.5">{description}</p>
        </div>
      </div>
    </div>
  )
}

function DashedLine({ direction }: { direction: 'right' | 'left' }) {
  return (
    <div className="hidden lg:flex items-center px-1">
      <div className="w-10 border-t-2 border-dashed border-neutral-300 dark:border-neutral-600 relative">
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
        <div className="hidden lg:grid lg:grid-cols-[1fr_2fr_1fr] gap-4 items-center">
          {/* Left: Input sources */}
          <div>
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3 text-right">
              {t.inputLabel}
            </div>
            <div className="space-y-3">
              {t.inputs.map((item) => (
                <div key={item.title} className="flex items-center gap-2 justify-end">
                  <NodeCard title={item.title} description={item.description} tag={item.tag} logo={item.logo} />
                  <DashedLine direction="right" />
                </div>
              ))}
            </div>
          </div>

          {/* Center: Shumoku */}
          <CenterDemo description={t.centerDescription} />

          {/* Right: Monitoring sources */}
          <div>
            <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
              {t.monitoringLabel}
            </div>
            <div className="space-y-3">
              {t.monitoring.map((item) => (
                <div key={item.title} className="flex items-center gap-2">
                  <DashedLine direction="left" />
                  <NodeCard title={item.title} description={item.description} tag={item.tag} logo={item.logo} />
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

          <CenterDemo description={t.centerDescription} />

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
