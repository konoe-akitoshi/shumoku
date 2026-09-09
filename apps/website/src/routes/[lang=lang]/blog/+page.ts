import { postsFor } from '$lib/blog/posts'
import type { PageLoad } from './$types'

export const prerender = true
export const entries = () => [{ lang: 'en' }, { lang: 'ja' }]
export const load: PageLoad = async ({ parent }) => {
  const { lang } = await parent()
  return { posts: postsFor(lang) }
}
