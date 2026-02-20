import { cn } from '@/lib/cn'
import { sectionStyles } from './styles'
import { homeTranslations, type Locale } from './translations'

export function GallerySection({ locale }: { locale: string }) {
  const t = homeTranslations[locale as Locale]?.gallery ?? homeTranslations.en.gallery

  return (
    <section className={cn('relative overflow-hidden', sectionStyles.padding)}>
      <div className="max-w-6xl mx-auto">
        <h2 className={cn(sectionStyles.title, 'text-center mb-8 sm:mb-12')}>{t.title}</h2>

        <div className="grid md:grid-cols-2 gap-6">
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
      </div>
    </section>
  )
}
