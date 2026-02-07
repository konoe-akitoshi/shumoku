export type HeroTranslations = {
  badge: string
  title1: string
  title2: string
  description: string
  playground: string
  documentation: string
  npmDocsPrefix: string
  npmDocsLink: string
}

export type FeaturesTranslations = {
  title: string
  subtitle: string
  items: readonly { title: string; description: string }[]
}

export type CTATranslations = {
  title: string
  subtitle: string
  contact: string
}

export type UseCasesTranslations = {
  title: string
  subtitle: string
  items: readonly { title: string; description: string }[]
}

export type IntegrationsTranslations = {
  title: string
  subtitle: string
  items: readonly { title: string; description: string }[]
}

export const homeTranslations = {
  en: {
    hero: {
      badge: '',
      title1: 'Network diagrams',
      title2: 'built for operations teams.',
      description:
        'Centralize topology management, automate rendering, and integrate with your monitoring stack for enterprise operations.',
      playground: 'Playground',
      documentation: 'Documentation',
      npmDocsPrefix: 'Prefer npm?',
      npmDocsLink: 'See npm docs',
    },
    features: {
      title: 'What you can do',
      subtitle: 'Turn static diagrams into live operational dashboards',
      items: [
        {
          title: 'Live weathermap',
          description: 'Overlay real-time traffic utilization on links, color-coded by load',
        },
        {
          title: 'Alert visualization',
          description: 'Show active alerts from Zabbix, Prometheus, and Grafana on topology',
        },
        {
          title: 'Auto-generate from NetBox',
          description: 'Pull devices and cables from NetBox to build topology automatically',
        },
        {
          title: 'Interactive dashboards',
          description: 'Pan, zoom, and drill into multi-layer network views in the browser',
        },
        {
          title: '900+ vendor icons',
          description: 'Yamaha, Aruba, AWS, Juniper, and more — rendered at correct aspect ratios',
        },
        {
          title: 'Shareable links',
          description: 'Publish topology views with a share token — no login required',
        },
      ],
    },
    useCases: {
      title: 'Use cases',
      subtitle: 'Where operational teams use Shumoku',
      items: [
        {
          title: 'NOC monitoring',
          description: 'Unified view of traffic, alerts, and topology for daily ops',
        },
        {
          title: 'Troubleshooting',
          description: 'Identify bottlenecks and failing nodes during incidents',
        },
        {
          title: 'Change management',
          description: 'Review topology updates with approvals and audit trails',
        },
      ],
    },
    integrations: {
      title: 'Integrations',
      subtitle: 'Connect your monitoring stack',
      items: [
        {
          title: 'Zabbix',
          description: 'Pull traffic metrics, host status, and alerts via JSON-RPC API',
        },
        {
          title: 'Prometheus',
          description: 'Query SNMP and node exporter metrics for link utilization',
        },
        {
          title: 'Grafana',
          description: 'Receive alerts via webhook and display them on topology',
        },
        {
          title: 'NetBox',
          description: 'Auto-discover topology from DCIM inventory and IPAM data',
        },
        {
          title: 'REST API',
          description: 'Render topologies and fetch metrics programmatically from your own tools',
        },
      ],
    },
    cta: {
      title: 'Evaluating for your organization?',
      subtitle: 'Talk to us about deployment, integrations, and support',
      contact: 'Contact us',
    },
    adopters: {
      title: 'Trusted by',
    },
  },
  ja: {
    hero: {
      badge: '',
      title1: 'Network diagrams',
      title2: 'built for operations teams.',
      description:
        '運用チーム向けに、トポロジー管理の一元化、生成の自動化、監視スタックとの連携を提供します。',
      playground: 'Playground',
      documentation: 'Documentation',
      npmDocsPrefix: 'npm 版はこちら:',
      npmDocsLink: 'npm ドキュメント',
    },
    features: {
      title: 'できること',
      subtitle: '静的な構成図をライブな運用ダッシュボードに',
      items: [
        {
          title: 'ライブ Weathermap',
          description: 'リンク上にトラフィック使用率をリアルタイム表示、負荷に応じて色分け',
        },
        {
          title: 'アラート可視化',
          description: 'Zabbix・Prometheus・Grafana のアラートをトポロジー上に表示',
        },
        {
          title: 'NetBox から自動生成',
          description: 'NetBox のデバイス・ケーブル情報からトポロジーを自動構築',
        },
        {
          title: 'インタラクティブダッシュボード',
          description: 'ブラウザでパン・ズーム、多階層ネットワークをドリルダウン',
        },
        {
          title: '900+ ベンダーアイコン',
          description: 'Yamaha, Aruba, AWS, Juniper など — 正しいアスペクト比で描画',
        },
        {
          title: '共有リンク',
          description: 'トークン付きリンクでトポロジーを公開 — ログイン不要',
        },
      ],
    },
    useCases: {
      title: 'ユースケース',
      subtitle: '運用チームでの活用',
      items: [
        {
          title: 'NOC 監視',
          description: 'トラフィック・アラート・トポロジーを一画面で把握',
        },
        {
          title: '障害対応',
          description: '輻輳リンクや障害ノードをインシデント時に特定',
        },
        {
          title: '変更管理',
          description: '変更のレビュー、承認、監査ログに対応',
        },
      ],
    },
    integrations: {
      title: '連携',
      subtitle: '監視スタックと接続',
      items: [
        {
          title: 'Zabbix',
          description: 'JSON-RPC API でトラフィックメトリクス・ホスト状態・アラートを取得',
        },
        {
          title: 'Prometheus',
          description: 'SNMP / Node Exporter メトリクスでリンク使用率を表示',
        },
        {
          title: 'Grafana',
          description: 'Webhook でアラートを受信しトポロジー上に表示',
        },
        {
          title: 'NetBox',
          description: 'DCIM・IPAM データからトポロジーを自動検出',
        },
        {
          title: 'REST API',
          description: '独自ツールからトポロジー描画やメトリクス取得をプログラマブルに実行',
        },
      ],
    },
    cta: {
      title: 'チーム導入を検討中ですか？',
      subtitle: '導入相談、連携、サポートについてご相談ください',
      contact: 'お問い合わせ',
    },
    adopters: {
      title: '採用実績',
    },
  },
} as const

export type Locale = keyof typeof homeTranslations
export type HomeTranslations = (typeof homeTranslations)[Locale]
