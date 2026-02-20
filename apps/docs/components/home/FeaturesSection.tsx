import { cn } from '@/lib/cn'
import { backgrounds, sectionStyles } from './styles'
import { homeTranslations, type Locale } from './translations'

const cardBase =
  'rounded-2xl border border-neutral-200/70 dark:border-neutral-700/50 bg-white/90 dark:bg-neutral-800/60 overflow-hidden hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors'

const imgBorder = 'rounded-lg border border-neutral-100 dark:border-neutral-700/30'

function FeatureCard({
  title,
  description,
  image,
  imageAlt,
  className,
}: {
  title: string
  description: string
  image: string
  imageAlt: string
  className?: string
}) {
  return (
    <div className={cn(cardBase, 'flex flex-col h-full', className)}>
      <div className="p-4 pb-2 shrink-0">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-500">{description}</p>
      </div>
      <div className="px-2.5 pb-2.5 flex-1 min-h-0">
        <img
          src={image}
          alt={imageAlt}
          className={cn('w-full h-full object-cover object-top', imgBorder)}
        />
      </div>
    </div>
  )
}

export function FeaturesSection({ locale }: { locale: string }) {
  const t = homeTranslations[locale as Locale]?.features ?? homeTranslations.en.features
  const items = t.items

  return (
    <section className={cn('relative overflow-hidden', sectionStyles.padding)}>
      <div className={cn('absolute inset-0 pointer-events-none', backgrounds.features)} />

      <div className="max-w-5xl mx-auto">
        <h2 className={cn(sectionStyles.title, 'text-center mb-8 sm:mb-12')}>{t.title}</h2>

        {/* Bento grid: 3col × 3row */}
        {/* Row 1-2: Weathermap(2col,2row) | Alert + NetBox stacked */}
        {/* Row 3: Icons | Nav | Share */}
        <div className="grid grid-cols-1 sm:grid-cols-3 sm:grid-rows-[180px_180px_200px] gap-4">
          {/* Weathermap — large hero card */}
          <FeatureCard
            title={items[0].title}
            description={items[0].description}
            image="/screenshots/wethermap.png"
            imageAlt="Live weathermap with traffic tooltip"
            className="sm:col-span-2 sm:row-span-2"
          />

          {/* Alert — stacked top-right */}
          <FeatureCard
            title={items[1].title}
            description={items[1].description}
            image="/screenshots/alert.png"
            imageAlt="Alert overlay on topology"
          />

          {/* NetBox — stacked bottom-right */}
          <FeatureCard
            title={items[2].title}
            description={items[2].description}
            image="/screenshots/netbox.png"
            imageAlt="NetBox topology source configuration"
          />

          {/* Bottom row: 3 equal cards */}
          <FeatureCard
            title={items[4].title}
            description={items[4].description}
            image="/screenshots/icon.png"
            imageAlt="Vendor icons rendered at correct aspect ratios"
          />
          <FeatureCard
            title={items[3].title}
            description={items[3].description}
            image="/screenshots/zoom.png"
            imageAlt="Pan and zoom controls"
          />
          <FeatureCard
            title={items[5].title}
            description={items[5].description}
            image="/screenshots/share.png"
            imageAlt="Share link dialog"
          />
        </div>
      </div>
    </section>
  )
}
