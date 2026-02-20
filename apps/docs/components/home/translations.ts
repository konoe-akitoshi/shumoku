export type HeroTranslations = {
  label: string
  title1: string
  title2: string
  description1: string
  description2: string
  deploy: string
  demo: string
  githubLabel: string
}

export type WhyTranslations = {
  problem: {
    title: string
    items: readonly string[]
  }
  arrow: string
  solution: {
    title: string
    items: readonly string[]
  }
}

export type FeaturesTranslations = {
  title: string
  items: readonly { title: string; description: string }[]
}

export type GalleryTranslations = {
  title: string
  items: readonly { src: string; alt: string; caption: string }[]
}

export type GettingStartedTranslations = {
  title: string
  community: {
    label: string
    steps: readonly string[]
    cta: string
  }
  production: {
    label: string
    items: readonly string[]
    cta: string
  }
}

export type IntegrationsTranslations = {
  title: string
  inputLabel: string
  monitoringLabel: string
  centerDescription: string
  inputs: readonly { title: string; description: string; tag?: string; logo?: string }[]
  monitoring: readonly { title: string; description: string; tag?: string; logo?: string }[]
}

export type ForTeamsTranslations = {
  tagline1: string
  tagline2: string
  title: string
  description: string
  nodes: readonly { title: string; description: string }[]
  roadmapLabel: string
  roadmap: readonly string[]
  cta: string
  adopters: {
    title: string
    items: readonly { quote: string; attribution: string }[]
  }
}

export type BottomTranslations = {
  faq: {
    title: string
    items: readonly { question: string; answer: string }[]
  }
  community: {
    items: readonly { name: string; url: string }[]
  }
  cta: {
    title: string
    deploy: string
    contact: string
  }
}

export const homeTranslations = {
  en: {
    hero: {
      label: 'Infrastructure Topology Platform',
      title1: 'Topology you',
      title2: 'can trust.',
      description1: 'Automatically derived from real infrastructure.',
      description2: 'Built for operations teams and enterprise environments.',
      deploy: 'Deploy Server',
      demo: 'Request Demo',
      githubLabel: 'GitHub',
    },
    why: {
      problem: {
        title: 'Without Shumoku',
        items: [
          'Hand-drawn diagrams drift from reality',
          'CMDB data goes stale silently',
          'Nobody knows the true structure during incidents',
        ],
      },
      arrow: 'Shumoku derives topology from your actual infrastructure',
      solution: {
        title: 'With Shumoku',
        items: [
          'Topology auto-generated from NetBox, custom API',
          'Live traffic and alerts from Zabbix, Prometheus, Grafana',
          'Single source of truth — always current',
        ],
      },
    },
    features: {
      title: 'Features',
      items: [
        { title: 'Live weathermap', description: 'Traffic utilization on links, color-coded by load' },
        { title: 'Alert overlay', description: 'Active alerts from Zabbix, Prometheus, Grafana on topology' },
        { title: 'NetBox auto-generation', description: 'Devices and cables pulled directly from NetBox' },
        { title: 'Interactive navigation', description: 'Pan, zoom, multi-layer drill-down in the browser' },
        { title: '900+ vendor icons', description: 'Yamaha, Aruba, AWS, Juniper — correct aspect ratios' },
        { title: 'Shareable links', description: 'Public topology views with a token — no login required' },
      ],
    },
    gallery: {
      title: 'In production',
      items: [
        {
          src: '/screenshots/topology.png',
          alt: 'Topology viewer with live weathermap',
          caption: 'Live traffic overlay — JANOG57 NOC',
        },
        {
          src: '/screenshots/dashboard.png',
          alt: 'NOC dashboard',
          caption: 'NOC dashboard — JANOG57',
        },
      ],
    },
    gettingStarted: {
      title: 'Deploy',
      community: {
        label: 'Community',
        steps: ['docker compose up -d', 'Open localhost:3000', 'Upload YAML or connect NetBox'],
        cta: 'Setup Guide',
      },
      production: {
        label: 'Enterprise',
        items: [
          'Architecture guidance',
          'Scaling & HA setup',
          'Custom plugin development',
          'Maintenance support',
        ],
        cta: 'Contact Us',
      },
    },
    integrations: {
      title: 'Integrations',
      inputLabel: 'Topology Sources',
      monitoringLabel: 'Monitoring Sources',
      centerDescription: 'Topology visualization from your infrastructure',
      inputs: [
        { title: 'YAML', description: 'Define topology as code', tag: 'built-in' },
        { title: 'NetBox', description: 'Auto-discover from DCIM/IPAM', tag: 'plugin', logo: '/integrations/netbox.svg' },
      ],
      monitoring: [
        { title: 'Zabbix', description: 'Traffic, host status, alerts', tag: 'plugin', logo: '/integrations/zabbix.svg' },
        { title: 'Prometheus', description: 'SNMP & node exporter metrics', tag: 'plugin', logo: '/integrations/prometheus.svg' },
        { title: 'Grafana', description: 'Webhook alerts', tag: 'plugin', logo: '/integrations/grafana.svg' },
        { title: 'Custom API', description: 'Your own data source', tag: 'plugin' },
      ],
    },
    forTeams: {
      tagline1: 'Shumoku is more than software.',
      tagline2: "It's a foundation we build together.",
      title: 'Build with Shumoku',
      description: 'Extend and embed Shumoku into your own products and workflows.',
      nodes: [
        { title: 'Custom Plugins', description: 'Proprietary data source integrations' },
        { title: 'Product Embedding', description: '@shumoku packages in your products' },
        { title: 'API Extensions', description: 'Custom APIs and platform extensions' },
        { title: 'Enterprise Roadmap', description: 'SSO, RBAC, audit logging' },
      ],
      roadmapLabel: 'Roadmap',
      roadmap: ['SSO & access control', 'Role-based permissions', 'Audit logging'],
      cta: 'Design your topology strategy',
      adopters: {
        title: 'Early adopters',
        items: [
          {
            quote: 'Replaced static Visio diagrams with auto-generated live topology. Used in production for JANOG57 NOC.',
            attribution: 'Network Operations — JANOG57',
          },
          {
            quote: 'Campus network monitoring with Zabbix. Live weathermaps running within a day.',
            attribution: 'Infrastructure Team — University NOC',
          },
        ],
      },
    },
    bottom: {
      faq: {
        title: 'FAQ',
        items: [
          {
            question: 'Is it free?',
            answer: 'Community edition is MIT licensed. We offer paid support, consulting, and custom development for production use.',
          },
          {
            question: 'How is it different from PHP Weathermap?',
            answer: 'Dedicated topology-first UI with multi-layer navigation, 900+ vendor icons, and native integrations — no Grafana required.',
          },
          {
            question: 'Can I use it without monitoring tools?',
            answer: 'Yes. Works as a standalone topology viewer. Monitoring integrations are optional.',
          },
        ],
      },
      community: {
        items: [
          { name: 'GitHub', url: 'https://github.com/konoe-akitoshi/shumoku' },
          { name: 'X', url: 'https://x.com/shumoku_dev' },
          { name: 'Email', url: 'mailto:contact@shumoku.dev' },
        ],
      },
      cta: {
        title: 'Ready to deploy?',
        deploy: 'Deploy Server',
        contact: 'Contact Us',
      },
    },
    adopters: {
      title: 'Used by teams in production environments',
    },
  },
  ja: {
    hero: {
      label: 'Infrastructure Topology Platform',
      title1: '信頼できる',
      title2: 'トポロジーを。',
      description1: '現実のインフラから自動生成される構造基盤。',
      description2: '運用チームとエンタープライズ環境のために。',
      deploy: 'サーバーを導入',
      demo: 'デモを見る',
      githubLabel: 'GitHub',
    },
    why: {
      problem: {
        title: 'Shumoku なしでは',
        items: [
          '手書きの構成図は現実と乖離する',
          'CMDB のデータは気づかないうちに陳腐化する',
          '障害時に誰も正しい構造を把握していない',
        ],
      },
      arrow: 'Shumoku は実際のインフラからトポロジーを導出します',
      solution: {
        title: 'Shumoku があれば',
        items: [
          'NetBox・独自APIからトポロジーを自動生成',
          'Zabbix・Prometheus・Grafana のトラフィック・アラートを自動オーバーレイ',
          'Single Source of Truth — 常に最新',
        ],
      },
    },
    features: {
      title: '機能',
      items: [
        { title: 'ライブ Weathermap', description: 'リンクのトラフィック使用率を負荷に応じて色分け表示' },
        { title: 'アラートオーバーレイ', description: 'Zabbix・Prometheus・Grafana のアラートをトポロジー上に表示' },
        { title: 'NetBox 自動生成', description: 'NetBox からデバイス・ケーブル情報を直接取得' },
        { title: 'インタラクティブ操作', description: 'パン・ズーム・多階層ドリルダウン' },
        { title: '900+ ベンダーアイコン', description: 'Yamaha, Aruba, AWS, Juniper — 正しいアスペクト比' },
        { title: '共有リンク', description: 'トークン付き公開ビュー — ログイン不要' },
      ],
    },
    gallery: {
      title: '本番稼働実績',
      items: [
        {
          src: '/screenshots/topology.png',
          alt: 'ライブ Weathermap 付きトポロジービューア',
          caption: 'ライブトラフィック表示 — JANOG57 NOC',
        },
        {
          src: '/screenshots/dashboard.png',
          alt: 'NOC ダッシュボード',
          caption: 'NOC ダッシュボード — JANOG57',
        },
      ],
    },
    gettingStarted: {
      title: 'デプロイ',
      community: {
        label: 'コミュニティ',
        steps: ['docker compose up -d', 'localhost:3000 を開く', 'YAML アップロードまたは NetBox 接続'],
        cta: 'セットアップガイド',
      },
      production: {
        label: 'エンタープライズ',
        items: [
          'アーキテクチャガイダンス',
          'スケーリング & HA 構成',
          'カスタムプラグイン開発',
          'メンテナンスサポート',
        ],
        cta: 'お問い合わせ',
      },
    },
    integrations: {
      title: '連携',
      inputLabel: 'トポロジーソース',
      monitoringLabel: '監視ソース',
      centerDescription: 'インフラからトポロジーを可視化',
      inputs: [
        { title: 'YAML', description: 'トポロジーをコードで定義', tag: 'built-in' },
        { title: 'NetBox', description: 'DCIM/IPAM から自動検出', tag: 'plugin', logo: '/integrations/netbox.svg' },
      ],
      monitoring: [
        { title: 'Zabbix', description: 'トラフィック・ホスト状態・アラート', tag: 'plugin', logo: '/integrations/zabbix.svg' },
        { title: 'Prometheus', description: 'SNMP & Node Exporter メトリクス', tag: 'plugin', logo: '/integrations/prometheus.svg' },
        { title: 'Grafana', description: 'Webhook アラート', tag: 'plugin', logo: '/integrations/grafana.svg' },
        { title: 'Custom API', description: '独自データソース', tag: 'plugin' },
      ],
    },
    forTeams: {
      tagline1: 'Shumoku はただのソフトウェアではありません。',
      tagline2: '一緒に築いていく基盤です。',
      title: 'Shumoku と一緒に作る',
      description: '自社プロダクトやワークフローに Shumoku を組み込み・拡張できます。',
      nodes: [
        { title: 'カスタムプラグイン', description: '独自データソース連携' },
        { title: 'プロダクト組み込み', description: '@shumoku パッケージで製品に統合' },
        { title: 'API 拡張', description: '独自APIとプラットフォーム拡張' },
        { title: 'エンタープライズ', description: 'SSO・RBAC・監査ログ' },
      ],
      roadmapLabel: 'ロードマップ',
      roadmap: ['SSO & アクセス制御', 'ロールベース権限管理', '監査ログ'],
      cta: 'トポロジー戦略を設計する',
      adopters: {
        title: '導入実績',
        items: [
          {
            quote: '静的な Visio 図面を自動生成のライブトポロジーに置き換え。JANOG57 NOC で本番運用。',
            attribution: 'ネットワーク運用 — JANOG57',
          },
          {
            quote: 'Zabbix 連携でキャンパスネットワーク監視に導入。1日で Weathermap が稼働。',
            attribution: 'インフラチーム — 大学 NOC',
          },
        ],
      },
    },
    bottom: {
      faq: {
        title: 'FAQ',
        items: [
          {
            question: '無料ですか？',
            answer: 'コミュニティ版は MIT ライセンス。本番向けに有償サポート・コンサルティング・カスタム開発を提供。',
          },
          {
            question: 'PHP Weathermap との違いは？',
            answer: 'トポロジーファースト UI、多階層ナビ、900+ ベンダーアイコン、ネイティブ連携 — Grafana 不要。',
          },
          {
            question: '監視ツールなしでも使える？',
            answer: 'はい。スタンドアロンのトポロジービューアとして動作。監視連携はオプション。',
          },
        ],
      },
      community: {
        items: [
          { name: 'GitHub', url: 'https://github.com/konoe-akitoshi/shumoku' },
          { name: 'X', url: 'https://x.com/shumoku_dev' },
          { name: 'Email', url: 'mailto:contact@shumoku.dev' },
        ],
      },
      cta: {
        title: '導入を始めますか？',
        deploy: 'サーバーを導入',
        contact: 'お問い合わせ',
      },
    },
    adopters: {
      title: '本番環境で運用チームに採用されています',
    },
  },
} as const

export type Locale = keyof typeof homeTranslations
export type HomeTranslations = (typeof homeTranslations)[Locale]
