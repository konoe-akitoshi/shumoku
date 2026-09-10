import { error } from '@sveltejs/kit'
import { loadPost, posts } from '$lib/blog/posts'
import { locales } from '$lib/site'
import type { EntryGenerator, PageLoad } from './$types'

export const prerender = true
export const entries: EntryGenerator = () =>
  posts.flatMap((post) => locales.map((lang) => ({ lang, slug: post.slug })))

export const load: PageLoad = async ({ params, parent }) => {
  const { lang } = await parent()
  const result = await loadPost(params.slug, lang)
  if (!result) error(404, 'Article not found')
  return result
}
