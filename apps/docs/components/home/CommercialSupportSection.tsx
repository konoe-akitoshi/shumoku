import { BriefcaseBusiness, Code2, LifeBuoy, Plug, ShieldCheck, Wrench } from 'lucide-react'
import { cn } from '@/lib/cn'
import { backgrounds, buttonStyles, sectionStyles } from './styles'
import type { Locale } from './translations'

const supportTranslations = {
  en: {
    eyebrow: 'Commercial support',
    title: 'Open source first, commercial help when you need it',
    lead: 'Shumoku is AGPL-3.0 open source software. A commercial contract is not required to use it. Paid support is a separate service for organizations that need private investigation, deadlines, or implementation help.',
    boundaryTitle: 'Support boundary',
    community: {
      title: 'Community',
      description:
        'Reproducible bugs, general questions, feature requests, and documentation improvements that can be discussed publicly.',
      route: 'GitHub Issues / Discussions / Discord',
    },
    commercial: {
      title: 'Commercial',
      description:
        'Environment-specific investigation, private support, guaranteed response, deadline-bound work, and custom development.',
      route: 'contact@shumoku.dev',
    },
    scopeTitle: 'Commercial work can cover',
    scope: [
      'Deployment and operations support',
      'Data source integration',
      'Environment-specific mapping',
      'Custom plugin development',
      'Priority or deadline-bound work',
      'Proof-of-concept support',
    ],
    partner:
      'Commercial support is delivered with non-exclusive partners such as TelHi Corporation (輝日株式会社). Project direction, roadmap, releases, and governance remain with the Shumoku Project.',
    cta: 'Contact us',
  },
  ja: {
    eyebrow: '商用サポート',
    title: 'OSS として使い、必要なところだけ商用で支える',
    lead: 'Shumoku は AGPL-3.0 のオープンソースソフトウェアです。利用にあたって商用契約は不要です。商用サポートは、特定環境の調査、非公開サポート、期限付き対応、導入支援が必要な組織向けの独立した有償サービスです。',
    boundaryTitle: 'コミュニティと商用の境界',
    community: {
      title: 'コミュニティ',
      description:
        '再現可能なバグ報告、一般的な質問、機能要望、ドキュメント改善など、公開の場で議論できるもの。',
      route: 'GitHub Issues / Discussions / Discord',
    },
    commercial: {
      title: '商用',
      description:
        '特定環境の調査、非公開サポート、応答保証、期限付き対応、優先実装、要件対応の開発。',
      route: 'contact@shumoku.dev',
    },
    scopeTitle: '商用サポートの範囲',
    scope: [
      '導入・運用支援',
      'データソース連携',
      '環境固有マッピング',
      'カスタムプラグイン開発',
      '優先対応・期限付き対応',
      'PoC 支援',
    ],
    partner:
      '商用サポートは TelHi Corporation（輝日株式会社）などの非独占的パートナーと協力して提供します。技術方針、ロードマップ、リリース、コミュニティガバナンスは Shumoku Project に帰属します。',
    cta: '相談する',
  },
} as const

const scopeIcons = [
  <Wrench key="deploy" className="w-4 h-4" />,
  <Plug key="integration" className="w-4 h-4" />,
  <ShieldCheck key="mapping" className="w-4 h-4" />,
  <Code2 key="plugin" className="w-4 h-4" />,
  <BriefcaseBusiness key="priority" className="w-4 h-4" />,
  <LifeBuoy key="poc" className="w-4 h-4" />,
]

export function CommercialSupportSection({ locale }: { locale: string }) {
  const t = supportTranslations[locale as Locale] ?? supportTranslations.en

  return (
    <section
      id="enterprise"
      className={cn('relative overflow-hidden scroll-mt-20', sectionStyles.padding)}
    >
      <div className={cn('absolute inset-0 pointer-events-none', backgrounds.cta)} />
      <div className="relative max-w-6xl mx-auto">
        <div className="max-w-3xl mb-8 sm:mb-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-3">
            {t.eyebrow}
          </p>
          <h2 className={cn(sectionStyles.title, 'mb-4')}>{t.title}</h2>
          <p className="text-sm sm:text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
            {t.lead}
          </p>
        </div>

        <div className="grid lg:grid-cols-[0.95fr_1.05fr] gap-6 lg:gap-8">
          <div>
            <h3 className="text-sm font-semibold mb-3">{t.boundaryTitle}</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-1 gap-4">
              {[t.community, t.commercial].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-neutral-200/70 dark:border-neutral-700/50 bg-white/90 dark:bg-neutral-800/60 p-5"
                >
                  <h4 className="text-sm font-semibold mb-1.5">{item.title}</h4>
                  <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-500 mb-3">
                    {item.description}
                  </p>
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    {item.route}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-3">{t.scopeTitle}</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {t.scope.map((item, i) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-xl border border-neutral-200/70 dark:border-neutral-700/50 bg-white/90 dark:bg-neutral-800/60 p-4"
                >
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200/50 dark:border-emerald-700/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                    {scopeIcons[i]}
                  </div>
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">{item}</span>
                </div>
              ))}
            </div>
            <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-500 mt-5">
              {t.partner}
            </p>
            <div className="mt-6">
              <a href="mailto:contact@shumoku.dev" className={cn(...buttonStyles.primary)}>
                {t.cta}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
