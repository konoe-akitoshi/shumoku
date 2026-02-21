import { defineI18nUI } from 'fumadocs-ui/i18n'
import { RootProvider } from 'fumadocs-ui/provider/next'
import '../global.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { i18n } from '@/lib/i18n'

const inter = Inter({
  subsets: ['latin'],
})

const meta = {
  en: {
    title: 'Shumoku - Infrastructure Topology Platform',
    description:
      'Auto-generate network topology from NetBox and YAML. Overlay live traffic and alerts from Zabbix, Prometheus, Grafana. 900+ vendor icons. Open source, enterprise ready.',
    ogTitle: 'Shumoku - Topology you can trust.',
    ogDescription:
      'Auto-generate topology from NetBox and YAML. Overlay live traffic and alerts from Zabbix and Prometheus.',
  },
  ja: {
    title: 'Shumoku - インフラ構成図プラットフォーム',
    description:
      'NetBox やYAML からネットワーク構成図を自動生成。Zabbix・Prometheus のトラフィックやアラートをリアルタイム表示。900以上のベンダーアイコン対応。',
    ogTitle: 'Shumoku - 信頼できる構成図を。',
    ogDescription:
      'NetBox やYAML から構成図を自動生成。Zabbix・Prometheus のトラフィック・アラートをリアルタイム表示。',
  },
} as const

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  const t = meta[lang as keyof typeof meta] ?? meta.en

  return {
    metadataBase: new URL('https://www.shumoku.dev'),
    title: {
      default: t.title,
      template: '%s | Shumoku',
    },
    description: t.description,
    openGraph: {
      title: t.ogTitle,
      description: t.ogDescription,
      siteName: 'Shumoku',
      type: 'website',
      images: [{ url: `/${lang}/og`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
    },
  }
}

const { provider } = defineI18nUI(i18n, {
  translations: {
    en: {
      displayName: 'English',
    },
    ja: {
      displayName: '日本語',
      search: 'ドキュメントを検索',
      searchNoResult: '結果が見つかりませんでした',
      toc: '目次',
      tocNoHeadings: '見出しがありません',
      lastUpdate: '最終更新',
      chooseLanguage: '言語を選択',
      nextPage: '次のページ',
      previousPage: '前のページ',
      chooseTheme: 'テーマを選択',
    },
  },
})

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const locale = lang as 'en' | 'ja'

  return (
    <html lang={lang} className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider i18n={provider(locale)}>{children}</RootProvider>
      </body>
    </html>
  )
}
