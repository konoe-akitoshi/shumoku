import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { docsOptions } from '@/lib/layout.shared'
import { source } from '@/lib/source'

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params

  return (
    <DocsLayout tree={source.getPageTree(lang)} {...docsOptions(lang)}>
      {children}
    </DocsLayout>
  )
}
