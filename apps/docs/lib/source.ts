import { docs } from 'fumadocs-mdx:collections/server'
import { type InferPageType, loader } from 'fumadocs-core/source'
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons'
import type { frontmatterSchema, metaSchema } from 'fumadocs-mdx/config'
import type { DocCollectionEntry, MetaCollectionEntry } from 'fumadocs-mdx/runtime/server'
import type { z } from 'zod'
import { i18n } from './i18n'

type DocsSourceConfig = {
  pageData: DocCollectionEntry<string, z.infer<typeof frontmatterSchema>>
  metaData: MetaCollectionEntry<z.infer<typeof metaSchema>>
}

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader<DocsSourceConfig, typeof i18n>({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
  i18n,
})

export function getPageImage(page: InferPageType<typeof source>) {
  const segments = [...page.slugs, 'image.png']

  return {
    segments,
    url: `/og/docs/${segments.join('/')}`,
  }
}

export async function getLLMText(page: InferPageType<typeof source>) {
  const processed = await page.data.getText('processed')

  return `# ${page.data.title}

${processed}`
}
