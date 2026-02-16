import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page'
import { createRelativeLink } from 'fumadocs-ui/mdx'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LLMCopyButton, ViewOptions } from '@/components/ai/page-actions'
import { getPageImage, source } from '@/lib/source'
import { getMDXComponents } from '@/mdx-components'

export default async function Page({
  params,
}: {
  params: Promise<{ lang: string; slug?: string[] }>
}) {
  const { lang, slug } = await params
  const page = source.getPage(slug, lang)
  if (!page) notFound()

  const MDX = page.data.body
  const gitConfig = {
    user: 'konoe-akitoshi',
    repo: 'shumoku',
    branch: 'main',
  }

  const githubPath = page.slugs.length === 0 ? 'index' : page.slugs.join('/')

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription className="mb-0">{page.data.description}</DocsDescription>
      <div className="flex flex-row gap-2 items-center border-b pb-6">
        <LLMCopyButton markdownUrl={`${page.url}.mdx`} />
        <ViewOptions
          markdownUrl={`${page.url}.mdx`}
          githubUrl={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/apps/docs/content/docs/${githubPath}.${lang}.mdx`}
        />
      </div>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  )
}

export async function generateStaticParams() {
  return source.generateParams()
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug?: string[] }>
}): Promise<Metadata> {
  const { lang, slug } = await params
  const page = source.getPage(slug, lang)
  if (!page) notFound()

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      images: getPageImage(page).url,
    },
  }
}
