import { notFound } from 'next/navigation'
import { getLLMText, source } from '@/lib/source'

export const revalidate = false

export async function GET(_req: Request, { params }: RouteContext<'/llms.mdx/docs/[[...slug]]'>) {
  // biome-ignore lint/nursery/useAwaitThenable: Next.js params is a Promise in App Router
  const { slug } = await params
  const page = source.getPage(slug)
  if (!page) notFound()

  return new Response(await getLLMText(page), {
    headers: {
      'Content-Type': 'text/markdown',
    },
  })
}

export function generateStaticParams() {
  return source.generateParams()
}
