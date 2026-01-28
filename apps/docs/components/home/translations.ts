export type HeroTranslations = {
  badge: string
  title1: string
  title2: string
  description: string
  playground: string
  documentation: string
}

export type FeaturesTranslations = {
  title: string
  subtitle: string
  items: readonly { title: string; description: string }[]
}

export type CTATranslations = {
  title: string
  subtitle: string
  playground: string
}

export const homeTranslations = {
  en: {
    hero: {
      badge: '900+ vendor icons',
      title1: 'Network diagrams,',
      title2: 'as code.',
      description:
        'Define your network topology in YAML and auto-generate beautiful SVG diagrams. Version control with Git, integrate with CI/CD.',
      playground: 'Playground',
      documentation: 'Documentation',
    },
    features: {
      title: 'Why Shumoku?',
      subtitle: 'A modern diagram tool for network engineers',
      items: [
        {
          title: 'Define in YAML',
          description: 'Simple, readable YAML syntax. Easy to manage with Git and review',
        },
        {
          title: '900+ Vendor Icons',
          description: 'Support for major vendors: Yamaha, Aruba, AWS, Juniper, and more',
        },
        {
          title: 'Auto Layout',
          description: 'Hierarchical auto-layout powered by ELK.js. No manual positioning needed',
        },
        {
          title: 'SVG Export',
          description: 'High-quality vector format. Looks crisp at any zoom level',
        },
        {
          title: 'TypeScript',
          description: 'Full type safety. Perfect IDE autocompletion',
        },
        {
          title: 'NetBox Integration',
          description: 'Auto-generate diagrams from NetBox',
        },
      ],
    },
    cta: {
      title: 'Ready to get started?',
      subtitle: 'Try the Playground or read the documentation',
      playground: 'Try Playground',
    },
    adopters: {
      title: 'Trusted by',
    },
  },
  ja: {
    hero: {
      badge: '900+ ベンダーアイコン',
      title1: 'Network diagrams,',
      title2: 'as code.',
      description:
        'YAML でネットワーク構成を定義し、美しい SVG ダイアグラムを自動生成。Git でバージョン管理、CI/CD に統合。',
      playground: 'Playground',
      documentation: 'Documentation',
    },
    features: {
      title: 'Why Shumoku?',
      subtitle: 'ネットワークエンジニアのためのモダンなダイアグラムツール',
      items: [
        {
          title: 'YAML で定義',
          description: 'シンプルで読みやすい YAML 記法。Git で管理、レビューも簡単',
        },
        {
          title: '900+ ベンダーアイコン',
          description: 'Yamaha, Aruba, AWS, Juniper など主要ベンダーに対応',
        },
        {
          title: '自動レイアウト',
          description: 'ELK.js による階層的な自動レイアウト。手動配置不要',
        },
        {
          title: 'SVG エクスポート',
          description: '高品質なベクター形式。ズームしても綺麗',
        },
        {
          title: 'TypeScript',
          description: '完全な型安全性。IDE での補完も完璧',
        },
        {
          title: 'NetBox 連携',
          description: 'NetBox から自動でダイアグラム生成',
        },
      ],
    },
    cta: {
      title: 'Ready to get started?',
      subtitle: 'Playground で試すか、ドキュメントを読んでみてください',
      playground: 'Try Playground',
    },
    adopters: {
      title: '採用実績',
    },
  },
} as const

export type Locale = keyof typeof homeTranslations
export type HomeTranslations = (typeof homeTranslations)[Locale]
