import { Layers, PencilRuler, Server } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/cn'
import { sectionStyles } from './styles'
import { homeTranslations, type Locale } from './translations'

const layerIcons = [
  <Layers key="core" className="w-5 h-5" />,
  <PencilRuler key="editor" className="w-5 h-5" />,
  <Server key="server" className="w-5 h-5" />,
]

export function PlatformSection({ locale }: { locale: string }) {
  const t = homeTranslations[locale as Locale]?.platform ?? homeTranslations.en.platform

  return (
    <section className={cn('relative overflow-hidden', sectionStyles.padding)}>
      <div className="max-w-5xl mx-auto">
        <h2 className={cn(sectionStyles.title, 'text-center mb-3')}>{t.title}</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-500 text-center max-w-xl mx-auto mb-8 sm:mb-12">
          {t.description}
        </p>

        <div className="grid sm:grid-cols-3 gap-4">
          {t.layers.map((layer, i) => (
            <div
              key={layer.title}
              className="flex flex-col rounded-2xl border border-neutral-200/70 dark:border-neutral-700/50 bg-white/90 dark:bg-neutral-800/60 p-5"
            >
              <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200/50 dark:border-emerald-700/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3">
                {layerIcons[i]}
              </div>
              <h3 className="text-sm font-semibold mb-1">{layer.title}</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-500 flex-1">
                {layer.description}
              </p>
              {'cta' in layer && 'href' in layer && (
                <a
                  href={layer.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline mt-3 inline-flex items-center gap-1"
                >
                  {layer.cta} →
                </a>
              )}
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link
            href={`/${locale}#about`}
            className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            {t.philosophyCta} →
          </Link>
        </div>
      </div>
    </section>
  )
}
