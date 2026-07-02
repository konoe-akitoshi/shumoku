import { cn } from '@/lib/cn'
import { backgrounds, buttonStyles, sectionStyles } from '../home/styles'
import { type EnterpriseLocale, enterpriseTranslations } from './translations'

export function EnterpriseContent({ locale }: { locale: string }) {
  const t = enterpriseTranslations[locale as EnterpriseLocale] ?? enterpriseTranslations.en

  return (
    <>
      {/* Hero */}
      <section
        id="enterprise"
        className={cn('relative overflow-hidden scroll-mt-20', sectionStyles.padding)}
      >
        <div className={cn('absolute inset-0 pointer-events-none', backgrounds.hero)} />
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className={cn(sectionStyles.title, 'mb-4')}>{t.title}</h2>
          <p className={sectionStyles.subtitle}>{t.lead}</p>
        </div>
      </section>

      {/* Community vs commercial boundary */}
      <section className={cn('relative', sectionStyles.padding)}>
        <div className="max-w-4xl mx-auto">
          <h2 className={cn(sectionStyles.title, 'text-xl sm:text-2xl md:text-3xl mb-6')}>
            {t.boundary.heading}
          </h2>
          <div className="overflow-hidden rounded-2xl border border-neutral-200/70 dark:border-neutral-700/50">
            <table className="w-full text-sm">
              <tbody>
                {t.boundary.rows.map((row, i) => (
                  <tr
                    key={row.route}
                    className={cn(
                      i > 0 && 'border-t border-neutral-200/70 dark:border-neutral-700/50',
                      'bg-white/90 dark:bg-neutral-800/60',
                    )}
                  >
                    <td className="p-4 align-top text-neutral-700 dark:text-neutral-300">
                      {row.work}
                    </td>
                    <td className="p-4 align-top font-medium whitespace-nowrap text-emerald-600 dark:text-emerald-400">
                      {row.route}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-4 leading-relaxed">
            {t.boundary.note}
          </p>
        </div>
      </section>

      {/* Scope */}
      <section className={cn('relative overflow-hidden', sectionStyles.padding)}>
        <div className={cn('absolute inset-0 pointer-events-none', backgrounds.features)} />
        <div className="relative max-w-4xl mx-auto">
          <h2 className={cn(sectionStyles.title, 'text-xl sm:text-2xl md:text-3xl mb-6')}>
            {t.scope.heading}
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {t.scope.items.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-neutral-200/70 dark:border-neutral-700/50 bg-white/90 dark:bg-neutral-800/60 p-5"
              >
                <h3 className="text-sm font-semibold mb-1.5">{item.title}</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-500">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plugin policy */}
      <section className={cn('relative', sectionStyles.padding)}>
        <div className="max-w-4xl mx-auto">
          <h2 className={cn(sectionStyles.title, 'text-xl sm:text-2xl md:text-3xl mb-6')}>
            {t.plugins.heading}
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {t.plugins.items.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-neutral-200/70 dark:border-neutral-700/50 bg-white/90 dark:bg-neutral-800/60 p-5"
              >
                <h3 className="text-sm font-semibold mb-1.5">{item.title}</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-500">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Partner */}
      <section className={cn('relative', sectionStyles.padding)}>
        <div className="max-w-3xl mx-auto">
          <h2 className={cn(sectionStyles.title, 'text-xl sm:text-2xl md:text-3xl mb-6')}>
            {t.partner.heading}
          </h2>
          <div className="space-y-4 mb-8">
            {t.partner.paragraphs.map((p) => (
              <p
                key={p.slice(0, 24)}
                className="text-sm sm:text-base leading-relaxed text-neutral-700 dark:text-neutral-300"
              >
                {p}
              </p>
            ))}
          </div>

          <h3 className="text-sm font-semibold mb-2">{t.payment.heading}</h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
            {t.payment.paragraph}
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className={cn('relative overflow-hidden', sectionStyles.padding)}>
        <div className={cn('absolute inset-0 pointer-events-none', backgrounds.cta)} />
        <div className="relative max-w-2xl mx-auto text-center">
          <h2 className={cn(sectionStyles.title, 'mb-6')}>{t.cta.heading}</h2>
          <div className="flex flex-wrap gap-3 justify-center">
            <a href={`mailto:${t.cta.email}`} className={cn(...buttonStyles.primaryLarge)}>
              {t.cta.email}
            </a>
            <a
              href="https://github.com/konoe-akitoshi/shumoku/blob/main/COMMERCIAL_SUPPORT.md"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(...buttonStyles.secondaryLarge)}
            >
              {t.cta.githubLabel}
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
