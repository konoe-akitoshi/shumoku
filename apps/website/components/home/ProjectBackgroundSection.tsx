import { Feather, Landmark, Quote } from 'lucide-react'
import { cn } from '@/lib/cn'
import { sectionStyles } from './styles'
import type { Locale } from './translations'

const backgroundTranslations = {
  en: {
    eyebrow: 'Project background',
    title: 'About Shumoku',
    lead: 'The name, logo, and design philosophy all point to the same idea: topology diagrams should reveal a structure that already exists in the network.',
    cards: [
      {
        title: 'Name',
        description:
          'The name comes from the shumoku, the striker used with a hanging bell. Shumoku aims to be a quiet support for the beginning of network operations.',
      },
      {
        title: 'Logo',
        description:
          "The logo is modeled on Gabriel's wings: a symbol for the moment an unseen structure is brought into view.",
      },
      {
        title: 'Philosophy',
        description:
          'A diagram should not invent topology. It should give a readable outline to the connections, paths, and dependencies already present in the infrastructure.',
      },
    ],
  },
  ja: {
    eyebrow: '背景と思想',
    title: 'About Shumoku',
    lead: '名前、ロゴ、設計思想は、どれも同じ考えにつながっています。ネットワーク図は構造を作るものではなく、すでに存在している接続関係に輪郭を与えるものです。',
    cards: [
      {
        title: '名前の由来',
        description:
          'shumoku という名前は、喚鐘を鳴らす道具である撞木に由来します。ネットワーク運用の始まりを静かに支える小さな基点でありたい、という意味を込めています。',
      },
      {
        title: 'ロゴの由来',
        description:
          'ロゴはガブリエルの羽をモチーフにしています。見えなかった構造が人の前に示される瞬間を表すしるしです。',
      },
      {
        title: '思想',
        description:
          '図は構造を作るのではなく、機器の接続、経路、依存関係としてすでに存在しているものに、読める形の輪郭を与えるものです。',
      },
    ],
  },
} as const

const icons = [
  <Landmark key="name" className="w-5 h-5" />,
  <Feather key="logo" className="w-5 h-5" />,
  <Quote key="philosophy" className="w-5 h-5" />,
]

export function ProjectBackgroundSection({ locale }: { locale: string }) {
  const t = backgroundTranslations[locale as Locale] ?? backgroundTranslations.en

  return (
    <section id="about" className={cn('relative scroll-mt-20', sectionStyles.padding)}>
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-8 lg:gap-12 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-3">
              {t.eyebrow}
            </p>
            <h2 className={cn(sectionStyles.title, 'mb-4')}>{t.title}</h2>
            <p className="text-sm sm:text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
              {t.lead}
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            {t.cards.map((card, i) => (
              <div
                key={card.title}
                className="rounded-2xl border border-neutral-200/70 dark:border-neutral-700/50 bg-white/90 dark:bg-neutral-800/60 p-5"
              >
                <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200/50 dark:border-emerald-700/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3">
                  {icons[i]}
                </div>
                <h3 className="text-sm font-semibold mb-1.5">{card.title}</h3>
                <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-500">
                  {card.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
