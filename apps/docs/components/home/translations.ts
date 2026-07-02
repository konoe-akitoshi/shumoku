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

export type PlatformTranslations = {
  title: string
  description: string
  layers: readonly { title: string; description: string; cta?: string; href?: string }[]
  philosophyCta: string
}

export type ForTeamsTranslations = {
  tagline1: string
  tagline2: string
  title: string
  description: string
  nodes: readonly { title: string; description: string }[]
  roadmapLabel: string
  roadmap: readonly string[]
  supportNote: string
  supportCta: string
  cta: string
  adopters: {
    title: string
    items: readonly { quote: string; attribution: string }[]
  }
}

export type BottomTranslations = {
  faq: {
    title: string
    items: readonly {
      question: string
      answer: string
      cta?: { label: string; href: string }
    }[]
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
      arrow: 'Shumoku derives a living topology from your actual infrastructure',
      solution: {
        title: 'With Shumoku',
        items: [
          'Topology auto-generated from NetBox, network scan, custom API',
          'Live traffic and alerts from Zabbix, Prometheus, Grafana',
          'Single source of truth — always current',
        ],
      },
    },
    features: {
      title: 'Features',
      items: [
        {
          title: 'Live weathermap',
          description: 'Traffic utilization on links, color-coded by load',
        },
        {
          title: 'Alert overlay',
          description: 'Active alerts from Zabbix, Prometheus, Grafana on topology',
        },
        {
          title: 'NetBox auto-generation',
          description: 'Devices and cables pulled directly from NetBox',
        },
        {
          title: 'Interactive navigation',
          description: 'Pan, zoom, multi-layer drill-down in the browser',
        },
        {
          title: '900+ vendor icons',
          description: 'Yamaha, Aruba, AWS, Juniper — correct aspect ratios',
        },
        {
          title: 'Shareable links',
          description: 'Public topology views with a token — no login required',
        },
        {
          title: 'Network discovery',
          description:
            'Crawl your network via SNMP + LLDP from a seed device. No inventory required.',
        },
        {
          title: 'Custom layout engine',
          description:
            'Purpose-built hierarchical layout engine for network diagrams. No generic graph library.',
        },
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
        label: 'Open Source',
        steps: [
          'git clone && cd shumoku/apps/server',
          'docker compose up -d',
          'Open localhost:8080 and set admin password',
          'Import YAML or connect NetBox',
        ],
        cta: 'Setup Guide',
      },
      production: {
        label: 'Enterprise',
        items: [
          'Deployment architecture design',
          'Scaling & high availability',
          'Security & compliance review',
          'Priority support with SLA',
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
        {
          title: 'NetBox',
          description: 'Auto-discover from DCIM/IPAM',
          tag: 'plugin',
          logo: '/integrations/netbox.svg',
        },
        {
          title: 'Network scan',
          description: 'Discover topology via SNMP + LLDP from a seed device',
          tag: 'plugin',
        },
      ],
      monitoring: [
        {
          title: 'Zabbix',
          description: 'Traffic, host status, alerts',
          tag: 'plugin',
          logo: '/integrations/zabbix.svg',
        },
        {
          title: 'Prometheus',
          description: 'SNMP & node exporter metrics',
          tag: 'plugin',
          logo: '/integrations/prometheus.svg',
        },
        {
          title: 'Grafana',
          description: 'Webhook alerts',
          tag: 'plugin',
          logo: '/integrations/grafana.svg',
        },
        {
          title: 'Aruba Instant On',
          description: 'Hosts, metrics, and alerts from the Instant On portal',
          tag: 'plugin',
        },
        { title: 'Custom API', description: 'Your own data source', tag: 'plugin' },
      ],
    },
    platform: {
      title: 'Core, Editor, Server',
      description:
        'One core generates the map from code. Editor and Server are the apps that put it to work.',
      layers: [
        {
          title: 'Core',
          description:
            'Library + CLI — the heart of Diagram as Code. Turns YAML, NetBox, LLDP, and SNMP into a readable topology.',
        },
        {
          title: 'Editor',
          description:
            'Visual topology designer — place devices, modules, and cables; derive a bill of materials.',
          cta: 'Open Editor',
          href: 'https://editor.shumoku.dev/',
        },
        {
          title: 'Server',
          description:
            'Visualize and monitor — overlay live traffic, status, and alerts on the generated map.',
        },
      ],
      philosophyCta: 'Read our philosophy',
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
      supportNote:
        'Shumoku is AGPL-3.0 open source — no commercial contract required. Bugs and feature requests are public on GitHub; environment-specific work and guaranteed support are commercial.',
      supportCta: 'See enterprise support',
      cta: 'Design your topology strategy',
      adopters: {
        title: 'Early adopters',
        items: [
          {
            quote:
              'Replaced static topology diagrams with auto-generated live topology. Used in production for JANOG57 NOC. Streamed on NOC Live.',
            attribution: 'NOC BB Team — JANOG57',
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
            answer:
              'Shumoku is open source under AGPL-3.0 — free to use, no commercial contract required. We offer paid support, consulting, and custom development for production deployments.',
          },
          {
            question: 'How is it different from PHP Weathermap?',
            answer:
              'Dedicated topology-first UI with multi-layer navigation, 900+ vendor icons, and native integrations — no Grafana required.',
          },
          {
            question: 'Can I use it without monitoring tools?',
            answer:
              'Yes. Works as a standalone topology viewer. Monitoring integrations are optional.',
          },
          {
            question: 'What about enterprise support?',
            answer:
              'Public bug reports, questions, and feature requests are community support on GitHub. Investigating your specific environment, private support with guaranteed response, deadline-bound work, and custom development are commercial — reach us at contact@shumoku.dev. Commercial support is delivered together with our non-exclusive partner TelHi Corporation (輝日株式会社); there is no sole official reseller of Shumoku.',
            cta: { label: 'See the enterprise section', href: '#enterprise' },
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
      title2: '構成図を。',
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
      arrow: 'Shumoku は実際のインフラから、更新され続ける地図を導出します',
      solution: {
        title: 'Shumoku があれば',
        items: [
          'NetBox・ネットワークスキャン・独自APIからトポロジーを自動生成',
          'Zabbix・Prometheus・Grafana のトラフィック・アラートを自動オーバーレイ',
          'Single Source of Truth — 常に最新',
        ],
      },
    },
    features: {
      title: '機能',
      items: [
        {
          title: 'ライブ Weathermap',
          description: 'リンクのトラフィック使用率を負荷に応じて色分け表示',
        },
        {
          title: 'アラートオーバーレイ',
          description: 'Zabbix・Prometheus・Grafana のアラートをトポロジー上に表示',
        },
        { title: 'NetBox 自動生成', description: 'NetBox からデバイス・ケーブル情報を直接取得' },
        { title: 'インタラクティブ操作', description: 'パン・ズーム・多階層ドリルダウン' },
        {
          title: '900+ ベンダーアイコン',
          description: 'Yamaha, Aruba, AWS, Juniper — 正しいアスペクト比',
        },
        { title: '共有リンク', description: 'トークン付き公開ビュー — ログイン不要' },
        {
          title: 'ネットワークディスカバリ',
          description:
            'SNMP + LLDP によるシードクロールでネットワークを自動探索。インベントリ不要。',
        },
        {
          title: '専用レイアウトエンジン',
          description:
            'ネットワーク構成図のために設計された階層レイアウトエンジン。汎用グラフライブラリではない。',
        },
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
        label: 'オープンソース',
        steps: [
          'git clone && cd shumoku/apps/server',
          'docker compose up -d',
          'localhost:8080 を開き管理者パスワードを設定',
          'YAML インポートまたは NetBox 接続',
        ],
        cta: 'セットアップガイド',
      },
      production: {
        label: 'エンタープライズ',
        items: [
          'デプロイアーキテクチャ設計',
          'スケーリング & 高可用性',
          'セキュリティ & コンプライアンス',
          '優先サポート（SLA付き）',
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
        {
          title: 'NetBox',
          description: 'DCIM/IPAM から自動検出',
          tag: 'plugin',
          logo: '/integrations/netbox.svg',
        },
        {
          title: 'ネットワークスキャン',
          description: 'SNMP + LLDP でシード機器からトポロジーを自動探索',
          tag: 'plugin',
        },
      ],
      monitoring: [
        {
          title: 'Zabbix',
          description: 'トラフィック・ホスト状態・アラート',
          tag: 'plugin',
          logo: '/integrations/zabbix.svg',
        },
        {
          title: 'Prometheus',
          description: 'SNMP & Node Exporter メトリクス',
          tag: 'plugin',
          logo: '/integrations/prometheus.svg',
        },
        {
          title: 'Grafana',
          description: 'Webhook アラート',
          tag: 'plugin',
          logo: '/integrations/grafana.svg',
        },
        {
          title: 'Aruba Instant On',
          description: 'Instant On ポータルからホスト・メトリクス・アラートを取得',
          tag: 'plugin',
        },
        { title: 'Custom API', description: '独自データソース', tag: 'plugin' },
      ],
    },
    platform: {
      title: 'Core, Editor, Server',
      description:
        'コアがコードから地図を生成し、Editor と Server がそれを現場で生かすアプリケーションです。',
      layers: [
        {
          title: 'Core',
          description:
            'Library + CLI — Diagram as Code の心臓部。YAML・NetBox・LLDP・SNMP を読める地図にする。',
        },
        {
          title: 'Editor',
          description:
            '設計・編集するビジュアルトポロジーデザイナー — 機器・モジュール・ケーブルを配置し、部材表（BOM）まで導出。',
          cta: 'Editor を開く',
          href: 'https://editor.shumoku.dev/',
        },
        {
          title: 'Server',
          description:
            '可視化・監視するアプリ — 生成された地図の上に流量・状態・アラートを重ねる。',
        },
      ],
      philosophyCta: '設計思想を読む',
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
      supportNote:
        'Shumoku は AGPL-3.0 の OSS — 利用に商用契約は不要です。バグ報告・機能要望は GitHub で公開対応、特定環境の調査や応答保証は商用サポートの対象です。',
      supportCta: '商用サポートを見る',
      cta: 'トポロジー戦略を設計する',
      adopters: {
        title: '導入実績',
        items: [
          {
            quote:
              '静的なトポロジー図を自動生成のライブトポロジーに置き換え。JANOG57 NOC で本番運用。NOC Liveで配信。',
            attribution: 'NOC BBチーム — JANOG57',
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
            answer:
              'Shumoku は AGPL-3.0 のオープンソースです。無料で利用でき、商用契約は不要です。本番導入向けに有償サポート・コンサルティング・カスタム開発を提供しています。',
          },
          {
            question: 'PHP Weathermap との違いは？',
            answer:
              'トポロジーファースト UI、多階層ナビ、900+ ベンダーアイコン、ネイティブ連携 — Grafana 不要。',
          },
          {
            question: '監視ツールなしでも使える？',
            answer: 'はい。スタンドアロンのトポロジービューアとして動作。監視連携はオプション。',
          },
          {
            question: 'エンタープライズサポートは？',
            answer:
              '公開できるバグ報告・質問・機能要望は GitHub でのコミュニティサポートです。特定環境の調査、非公開サポート、応答保証、期限付き対応、カスタム開発は商用サポートの対象で、contact@shumoku.dev までご連絡ください。商用サポートは非独占的パートナーの TelHi Corporation（輝日株式会社）と協力して提供しており、唯一の公式代理店は存在しません。',
            cta: { label: '商用サポートのセクションを見る', href: '#enterprise' },
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
