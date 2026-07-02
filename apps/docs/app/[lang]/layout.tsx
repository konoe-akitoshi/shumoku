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
      'Generate network maps from YAML, NetBox, LLDP, SNMP, and monitoring data. Use them in Markdown, CI, docs, or a self-hosted operations dashboard.',
    ogTitle: "Shumoku - Network diagrams that don't drift away from reality.",
    ogDescription:
      'Generate and update topology from real infrastructure data, then overlay traffic, status, and alerts for operations.',
  },
  ja: {
    title: 'Shumoku - インフラ構成図プラットフォーム',
    description:
      'YAML、NetBox、LLDP、SNMP、監視データからネットワーク地図を生成・更新。Markdown、CI、ドキュメント、セルフホスト型ダッシュボードで使えます。',
    ogTitle: 'Shumoku - 構成図を、実態に追従し続ける運用の地図へ。',
    ogDescription:
      '実際のインフラデータからトポロジーを生成し、流量・状態・アラートを重ねて運用ビューとして扱えます。',
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

export function generateStaticParams() {
  return i18n.languages.map((lang) => ({ lang }))
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
