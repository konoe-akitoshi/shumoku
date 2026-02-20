import { cn } from '@/lib/cn'
import { CodeIcon, ImageIcon, NetBoxIcon, TerminalIcon } from './icons'
import { backgrounds, cardStyles, sectionStyles } from './styles'
import { homeTranslations, type Locale } from './translations'

const integrationIcons = [
  <TerminalIcon key="zabbix" className="w-6 h-6" />,
  <TerminalIcon key="prometheus" className="w-6 h-6" />,
  <ImageIcon key="grafana" className="w-6 h-6" />,
  <NetBoxIcon key="netbox" className="w-6 h-6" />,
  <CodeIcon key="api" className="w-6 h-6" />,
]

export function IntegrationsSection({ locale }: { locale: string }) {
  const t = homeTranslations[locale as Locale]?.integrations ?? homeTranslations.en.integrations

  return (
    <section className={cn('relative overflow-hidden', sectionStyles.padding)}>
      <div className={cn('absolute inset-0 pointer-events-none', backgrounds.features)} />

      <div className="max-w-6xl mx-auto">
        <h2 className={cn(sectionStyles.title, 'text-center mb-8 sm:mb-12')}>{t.title}</h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {t.items.map((item, index) => (
            <div key={item.title} className={cn(...cardStyles.feature)}>
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#7FE4C1]/40 to-transparent dark:from-[#7FE4C1]/20 dark:to-transparent text-[#1F2328] dark:text-[#7FE4C1] flex items-center justify-center mb-3">
                {integrationIcons[index]}
              </div>
              <h3 className="text-base font-semibold mb-1">{item.title}</h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
