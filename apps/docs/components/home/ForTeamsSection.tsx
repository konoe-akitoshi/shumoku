import { cn } from '@/lib/cn'
import { Code2, Map, Package, Plug } from 'lucide-react'
import { sectionStyles } from './styles'
import { homeTranslations, type Locale } from './translations'

const nodeIcons = [
  <Code2 key="plugin" className="w-5 h-5" />,
  <Package key="embed" className="w-5 h-5" />,
  <Plug key="api" className="w-5 h-5" />,
  <Map key="roadmap" className="w-5 h-5" />,
]

function CoreNode() {
  return (
    <div className="relative flex items-center justify-center">
      <div className="absolute w-28 h-28 rounded-full bg-emerald-500/10 blur-xl" />
      <div className="relative w-20 h-20 rounded-full bg-white dark:bg-neutral-900 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10">
        <img src="/logo-symbol.svg" alt="Shumoku" className="w-10 h-10" />
      </div>
    </div>
  )
}

function SatelliteNode({
  title,
  description,
  icon,
}: {
  title: string
  description: string
  icon: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 w-40">
      <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200/50 dark:border-emerald-700/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
        {icon}
      </div>
      <div className="text-center">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-neutral-500 dark:text-neutral-500 mt-0.5">{description}</div>
      </div>
    </div>
  )
}

function DashedConnector({ orientation }: { orientation: 'vertical' | 'horizontal' }) {
  if (orientation === 'vertical') {
    return (
      <div className="flex justify-center py-1">
        <div className="w-px h-10 border-l-2 border-dashed border-emerald-300 dark:border-emerald-700/40" />
      </div>
    )
  }
  return (
    <div className="flex items-center px-2">
      <div className="h-px w-12 border-t-2 border-dashed border-emerald-300 dark:border-emerald-700/40" />
    </div>
  )
}

export function ForTeamsSection({ locale }: { locale: string }) {
  const t = homeTranslations[locale as Locale]?.forTeams ?? homeTranslations.en.forTeams

  return (
    <section className={cn('relative overflow-hidden', sectionStyles.padding)}>
      <div className="max-w-4xl mx-auto">
        {/* Tagline */}
        <p className="text-sm text-emerald-600 dark:text-emerald-400/80 text-center leading-relaxed mb-6">
          {t.tagline1}
          <br />
          {t.tagline2}
        </p>

        {/* Title */}
        <h2 className={cn(sectionStyles.title, 'text-center mb-16')}>{t.title}</h2>

        {/* Desktop: center-core cross layout */}
        <div className="hidden lg:flex flex-col items-center">
          {/* Top node */}
          <SatelliteNode title={t.nodes[0].title} description={t.nodes[0].description} icon={nodeIcons[0]} />
          <DashedConnector orientation="vertical" />

          {/* Middle row: left — center — right */}
          <div className="flex items-center justify-center">
            <SatelliteNode title={t.nodes[1].title} description={t.nodes[1].description} icon={nodeIcons[1]} />
            <DashedConnector orientation="horizontal" />
            <CoreNode />
            <DashedConnector orientation="horizontal" />
            <SatelliteNode title={t.nodes[2].title} description={t.nodes[2].description} icon={nodeIcons[2]} />
          </div>

          <DashedConnector orientation="vertical" />
          {/* Bottom node */}
          <SatelliteNode title={t.nodes[3].title} description={t.nodes[3].description} icon={nodeIcons[3]} />
        </div>

        {/* Mobile: stacked layout */}
        <div className="lg:hidden flex flex-col items-center gap-8">
          <CoreNode />
          <div className="grid grid-cols-2 gap-6 max-w-sm">
            {t.nodes.map((node, i) => (
              <SatelliteNode key={node.title} title={node.title} description={node.description} icon={nodeIcons[i]} />
            ))}
          </div>
        </div>

        {/* Roadmap pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-14">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mr-1">
            {t.roadmapLabel}
          </span>
          {t.roadmap.map((item) => (
            <div
              key={item}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-neutral-200/70 dark:border-neutral-700/50 bg-white dark:bg-neutral-800"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs text-neutral-600 dark:text-neutral-400">{item}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-10">
          <a
            href="mailto:info@shumoku.dev"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-base bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-400 text-neutral-950 shadow-[0_16px_35px_-18px_rgba(16,185,129,0.75)] hover:shadow-[0_18px_40px_-18px_rgba(16,185,129,0.9)] transition-shadow"
          >
            {t.cta}
          </a>
        </div>
      </div>
    </section>
  )
}
