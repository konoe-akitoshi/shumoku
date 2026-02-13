import { defineI18nUI } from 'fumadocs-ui/i18n'
import { RootProvider } from 'fumadocs-ui/provider/next'
import '../global.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { i18n } from '@/lib/i18n'

const inter = Inter({
  subsets: ['latin'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://www.shumoku.dev'),
  title: {
    default: 'Shumoku - Network Topology Diagram Generator',
    template: '%s | Shumoku',
  },
  description:
    'Network topology diagram generator. Generate SVG network diagrams from YAML. Supports Cisco, Yamaha, Juniper, Aruba, AWS icons (900+). NetBox integration. Diagram as code for network engineers.',
  openGraph: {
    title: 'Shumoku - Network Topology Diagram Generator',
    description:
      'Generate network topology diagrams from YAML. Diagram as code with 900+ vendor icons. NetBox integration.',
    siteName: 'Shumoku',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
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
