<script lang="ts">
  import { type Locale } from '@shumoku/website-content'
  import Icon from './Icon.svelte'
  import { cn, sectionStyles } from './styles'

  const overviewTranslations = {
    en: {
      eyebrow: 'What Shumoku is',
      title: 'A regenerable map for real infrastructure',
      lead: 'Shumoku treats network topology as an operational map that can be generated, updated, and trusted instead of a drawing that slowly drifts away from reality.',
      body: 'It can start from YAML, NetBox, LLDP, SNMP, network scans, monitoring systems, or your own APIs, then turn those sources into topology views for documentation, CI, web apps, and live operations.',
      quote: "Network diagrams that don't drift away from reality.",
      principles: [
        {
          title: 'Readable',
          description: 'The overall shape and connection relationships are clear at a glance.',
        },
        {
          title: 'Trustworthy',
          description: 'The map is grounded in actual infrastructure data, not stale slides.',
        },
        {
          title: 'Regenerable',
          description: 'Topology can be rebuilt continuously as the network changes.',
        },
        {
          title: 'Operational',
          description: 'Traffic, status, alerts, sharing, and documentation live on the same map.',
        },
      ],
    },
    ja: {
      eyebrow: 'Shumoku とは',
      title: '現実からずれない、再生成できるネットワーク地図',
      lead: 'Shumoku はネットワーク構成を、手で描いて古くなる静的な資料ではなく、実データから生成・更新できる運用の地図として扱うためのオープンソースプロジェクトです。',
      body: 'YAML、NetBox、LLDP、SNMP、ネットワークスキャン、監視システム、独自 API などを起点に、ドキュメント、CI、Web アプリケーション、運用ダッシュボードで使えるトポロジーへ変換します。',
      quote: '構成図を、描いて古くなる資料から、実態に追従し続ける運用の地図へ。',
      principles: [
        {
          title: '把握できる',
          description: '全体像と接続関係が一目で読み取れる。',
        },
        {
          title: '信頼できる',
          description: '古い資料ではなく、実ネットワークに基づく地図として扱える。',
        },
        {
          title: '更新できる',
          description: '構成変更に追従し、継続的に再生成できる。',
        },
        {
          title: '運用できる',
          description: '流量、状態、アラート、共有、ドキュメントを同じ地図上でつなげる。',
        },
      ],
    },
  } as const
  const icons = [
    { name: 'MapIcon', class: 'w-4 h-4' },
    { name: 'ShieldCheck', class: 'w-4 h-4' },
    { name: 'RefreshCw', class: 'w-4 h-4' },
    { name: 'FileCode2', class: 'w-4 h-4' },
  ]
  let { locale }: { locale: string } = $props()
  const t = $derived(overviewTranslations[locale as Locale] ?? overviewTranslations.en)
</script>
<section class={cn('relative overflow-hidden', sectionStyles.padding)}>
  <div class="relative site-container">
    <div class="grid lg:grid-cols-[1.05fr_0.95fr] gap-8 lg:gap-12 items-center">
      <div>
        <p
          class="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-3"
        >
          {t.eyebrow}
        </p>
        <h2 class={cn(sectionStyles.title, 'mb-4')}>{t.title}</h2>
        <p class="text-base sm:text-lg leading-relaxed text-neutral-700 dark:text-neutral-300">
          {t.lead}
        </p>
        <p class="text-sm sm:text-base leading-relaxed text-neutral-600 dark:text-neutral-400 mt-4">
          {t.body}
        </p>
        <blockquote class="border-l-2 border-emerald-500 pl-4 mt-6">
          <p
            class="text-balance text-base sm:text-lg font-semibold text-neutral-900 dark:text-white leading-snug"
          >
            {t.quote}
          </p>
        </blockquote>
      </div>
      <div class="grid sm:grid-cols-2 gap-4">
        {#each t.principles as item, i}
          <div
            class="rounded-2xl border border-neutral-200/70 dark:border-neutral-700/50 bg-white/90 dark:bg-neutral-800/60 p-5"
          >
            <div class="flex items-center gap-3 mb-2">
              <div
                class="shrink-0 w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200/50 dark:border-emerald-700/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400"
              >
                <Icon value={icons[i]} />
              </div>
              <h3 class="text-sm font-semibold">{item.title}</h3>
            </div>
            <p class="text-xs leading-relaxed text-neutral-500 dark:text-neutral-500">
              {item.description}
            </p>
          </div>
        {/each}
      </div>
    </div>
  </div>
</section>
