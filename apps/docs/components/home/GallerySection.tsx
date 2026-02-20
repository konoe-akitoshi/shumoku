import { cn } from '@/lib/cn'
import { sectionStyles } from './styles'
import { homeTranslations, type Locale } from './translations'

export function GallerySection({ locale }: { locale: string }) {
  const t = homeTranslations[locale as Locale]?.gallery ?? homeTranslations.en.gallery
  const forTeams = homeTranslations[locale as Locale]?.forTeams ?? homeTranslations.en.forTeams

  return (
    <section className={cn('relative overflow-hidden', sectionStyles.padding)}>
      <div className="max-w-5xl mx-auto">
        <h2 className={cn(sectionStyles.title, 'text-center mb-8 sm:mb-12')}>{t.title}</h2>

        {/* Screenshots */}
        <div className="grid md:grid-cols-2 gap-6 mb-10 sm:mb-14">
          {t.items.map((item) => (
            <div key={item.src}>
              <div className="rounded-2xl overflow-hidden border border-neutral-200/70 dark:border-neutral-800/70 shadow-lg">
                <img src={item.src} alt={item.alt} className="w-full h-auto" />
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-2 text-center">
                {item.caption}
              </p>
            </div>
          ))}
        </div>

        {/* Quotes */}
        <div className="grid md:grid-cols-2 gap-4">
          {forTeams.adopters.items.map((item) => (
            <div
              key={item.attribution}
              className="rounded-xl border border-neutral-200/70 dark:border-neutral-700/50 p-5 bg-white/90 dark:bg-neutral-800/60"
            >
              <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-3 leading-relaxed">
                &ldquo;{item.quote}&rdquo;
              </p>
              <p className="text-xs text-neutral-500">{item.attribution}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
