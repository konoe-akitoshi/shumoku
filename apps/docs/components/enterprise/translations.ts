export type EnterpriseTranslations = {
  title: string
  lead: string
  boundary: {
    heading: string
    rows: readonly { work: string; route: string }[]
    note: string
  }
  scope: {
    heading: string
    items: readonly { title: string; description: string }[]
  }
  plugins: {
    heading: string
    items: readonly { title: string; description: string }[]
  }
  partner: {
    heading: string
    paragraphs: readonly string[]
  }
  payment: {
    heading: string
    paragraph: string
  }
  cta: {
    heading: string
    email: string
    githubLabel: string
  }
}

export const enterpriseTranslations = {
  en: {
    title: 'Enterprise',
    lead: 'Shumoku is free and open-source software under AGPL-3.0. Using it never requires a commercial relationship — commercial support is a separate, paid service for organizations that need more.',
    boundary: {
      heading: 'Community or commercial?',
      rows: [
        {
          work: 'A reproducible bug report, a general question, a feature request, a docs improvement — anything that can be discussed publicly and benefits the project as a whole',
          route: 'Community — GitHub Issues / Discussions',
        },
        {
          work: 'Investigation of your specific environment, private support, guaranteed response, a deadline, priority implementation, or development for your requirements',
          route: 'Commercial — contact@shumoku.dev',
        },
      ],
      note: 'Feature requests posted on GitHub are always welcome, but whether, when, and in what order they are implemented is decided by the Shumoku Project based on the roadmap and maintainability. A specific outcome on a specific timeline is commercial work.',
    },
    scope: {
      heading: 'What commercial support covers',
      items: [
        {
          title: 'Implementation and deployment support',
          description:
            'Installing and operating the Shumoku Server (and Editor) in your environment.',
        },
        {
          title: 'Data source integration',
          description:
            'Investigating and configuring connections to NetBox, Zabbix, Prometheus, Grafana, and similar systems.',
        },
        {
          title: 'Environment-specific mapping',
          description:
            'Adapting topology, metrics, and alert mappings to your network and conventions.',
        },
        {
          title: 'Custom plugin development',
          description:
            'Building integrations for data sources the open-source project does not cover.',
        },
        {
          title: 'Priority handling and deadline-bound work',
          description: 'Prioritized work on specific bugs or features within an agreed timeframe.',
        },
        {
          title: 'Proof-of-concept support',
          description: 'Helping you evaluate Shumoku against your requirements.',
        },
        {
          title: 'Operational design and ongoing support',
          description:
            'Consulting on running Shumoku in operations, and continued support after rollout.',
        },
      ],
    },
    plugins: {
      heading: 'Plugin policy',
      items: [
        {
          title: 'Bundled open-source plugins',
          description:
            'Maintained in the repository (zabbix, prometheus, netbox, grafana, aruba-instant-on, network-scan). Covered by community support.',
        },
        {
          title: 'Community plugins',
          description:
            'Built and published independently using the public plugin contract, maintained by their authors.',
        },
        {
          title: 'Commercially developed plugins',
          description:
            'Built as commercial work for a specific organization, may remain private. Whether it is later open-sourced is decided case by case.',
        },
      ],
    },
    partner: {
      heading: 'Commercial support partner',
      paragraphs: [
        'Commercial support and implementation services are provided by the Project Lead in collaboration with our commercial support partner, TelHi Corporation (輝日株式会社).',
        'This partnership is non-exclusive: there is no sole agent, exclusive distributor, or single official reseller of Shumoku, and other partners may offer services as well. Technical direction, the roadmap, releases, and community governance remain with the Shumoku Project.',
      ],
    },
    payment: {
      heading: 'A note on payment',
      paragraph:
        "Paying for commercial support buys services. It does not change the AGPL-3.0 terms of the software, and it does not buy influence over the project's direction.",
    },
    cta: {
      heading: 'Get in touch',
      email: 'contact@shumoku.dev',
      githubLabel: 'Full commercial support policy (GitHub)',
    },
  },
  ja: {
    title: 'Enterprise / 商用サポート',
    lead: 'Shumoku は AGPL-3.0 のオープンソースソフトウェアです。利用にあたって商用契約は不要です。商用サポートは、それ以上のサポートが必要な組織向けの、独立した有償サービスです。',
    boundary: {
      heading: 'コミュニティか、商用か',
      rows: [
        {
          work: '再現可能なバグ報告・一般的な質問・機能要望・ドキュメント改善など、公開の場で議論でき、プロジェクト全体の利益になるもの',
          route: 'コミュニティ — GitHub Issues / Discussions',
        },
        {
          work: '特定環境の調査、非公開サポート、応答保証、期限、優先実装、要件対応の開発',
          route: '商用 — contact@shumoku.dev',
        },
      ],
      note: 'GitHub での機能要望はいつでも歓迎ですが、実装するかどうか・いつ・どの順序でかはプロジェクトのロードマップとメンテナンス性に基づき Shumoku Project が判断します。特定の期限で特定の成果が必要な場合は商用の対象です。',
    },
    scope: {
      heading: '商用サポートの範囲',
      items: [
        {
          title: '導入・運用支援',
          description: 'お客様の環境での Shumoku Server（および Editor）のインストールと運用。',
        },
        {
          title: 'データソース連携',
          description: 'NetBox・Zabbix・Prometheus・Grafana 等との接続の調査・設定。',
        },
        {
          title: '環境固有マッピング',
          description:
            'トポロジー・メトリクス・アラートのマッピングを、お客様のネットワークと運用に合わせて調整。',
        },
        {
          title: 'カスタムプラグイン開発',
          description: 'OSS プロジェクトが対応していないデータソース向けの連携を開発。',
        },
        {
          title: '優先対応・期限付き対応',
          description: '合意した期間内で特定のバグ・機能を優先して対応。',
        },
        {
          title: 'PoC 支援',
          description: '要件に対する Shumoku の評価を支援。',
        },
        {
          title: '運用設計・継続サポート',
          description: '運用への組み込みに関するコンサルティングと、導入後の継続的なサポート。',
        },
      ],
    },
    plugins: {
      heading: 'プラグインポリシー',
      items: [
        {
          title: 'バンドル OSS プラグイン',
          description:
            'リポジトリで保守（zabbix, prometheus, netbox, grafana, aruba-instant-on, network-scan）。コミュニティサポートの対象。',
        },
        {
          title: 'コミュニティプラグイン',
          description: '公開プラグイン契約を使って誰でも独立して開発・公開できる。作者が保守する。',
        },
        {
          title: '商用開発プラグイン',
          description:
            '特定組織のための商用開発。非公開のまま提供される場合もあり、OSS 化するかはケースバイケースで判断。',
        },
      ],
    },
    partner: {
      heading: '商用サポートパートナー',
      paragraphs: [
        '商用サポート・導入支援は、プロジェクトリードと商用サポートパートナーである TelHi Corporation（輝日株式会社）が協力して提供しています。',
        'このパートナーシップは非独占的です。唯一の代理店・独占販売店・公式リセラーは存在せず、他のパートナーがサービスを提供することもあります。技術方針・ロードマップ・リリース・コミュニティガバナンスは Shumoku Project に帰属します。',
      ],
    },
    payment: {
      heading: '支払いについて',
      paragraph:
        '商用サポートへの支払いはサービスの対価です。AGPL-3.0 のライセンス条件を変更するものではなく、プロジェクトの方針への影響力を購入するものでもありません。',
    },
    cta: {
      heading: 'お問い合わせ',
      email: 'contact@shumoku.dev',
      githubLabel: '商用サポートポリシー全文（GitHub）',
    },
  },
} as const

export type EnterpriseLocale = keyof typeof enterpriseTranslations
