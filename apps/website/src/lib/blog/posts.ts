import type { Component } from 'svelte'
import type { Locale } from '$lib/site'
import { articleAsset } from './assets'

export interface Post {
  slug: string
  locale: Locale
  path: string
  title: string
  description: string
  date: string
  category?: string
  image?: string
  imageAlt?: string
  draft: boolean
}

export function readPost(path: string, value: unknown): Post {
  const match = /\/([^/]+)\/index\.md$/.exec(path)
  if (!match || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(match[1])) {
    throw new Error(`Invalid article path: ${path}`)
  }
  if (!value || typeof value !== 'object') throw new Error(`Missing frontmatter: ${path}`)
  const data = value as Record<string, unknown>
  for (const key of ['title', 'description', 'date']) {
    if (typeof data[key] !== 'string' || !data[key].trim()) {
      throw new Error(`Missing or invalid ${key}: ${path}`)
    }
  }
  const date = String(data.date)
  const parsed = new Date(date)
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new Error(`Use a quoted YYYY-MM-DD date: ${path}`)
  }
  for (const key of ['category', 'image', 'imageAlt']) {
    if (data[key] !== undefined && typeof data[key] !== 'string') {
      throw new Error(`Invalid ${key}: ${path}`)
    }
  }
  if (data.draft !== undefined && typeof data.draft !== 'boolean')
    throw new Error(`Invalid draft: ${path}`)
  if (data.image && (typeof data.imageAlt !== 'string' || !data.imageAlt.trim()))
    throw new Error(`imageAlt is required: ${path}`)
  if (typeof data.image === 'string' && !data.image.startsWith('./images/'))
    throw new Error(`Use an article-relative ./images/ cover: ${path}`)
  if (data.lang !== undefined && data.lang !== 'ja' && data.lang !== 'en')
    throw new Error(`Invalid lang: ${path}`)
  return {
    slug: match[1],
    locale: data.lang === 'en' ? 'en' : 'ja',
    path: `/blog/${match[1]}`,
    title: String(data.title),
    description: String(data.description),
    date,
    category: data.category as string | undefined,
    image: typeof data.image === 'string' ? articleAsset(match[1], data.image) : undefined,
    imageAlt: data.imageAlt as string | undefined,
    draft: data.draft === true,
  }
}

const metadata = import.meta.glob<unknown>('/src/content/blog/*/index.md', {
  eager: true,
  import: 'metadata',
})
const bodies = import.meta.glob<{ default: Component }>('/src/content/blog/*/index.md')

export const posts = Object.entries(metadata)
  .map(([path, data]) => readPost(path, data))
  .filter((post) => !post.draft)
  .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug))

export const findPost = (slug: string, locale: Locale) =>
  posts.find((post) => post.slug === slug && post.locale === locale) ??
  posts.find((post) => post.slug === slug)
export const postsFor = (locale: Locale) =>
  posts.filter((post) => findPost(post.slug, locale) === post)

export async function loadPost(slug: string, locale: Locale) {
  const post = findPost(slug, locale)
  const load = bodies[`/src/content/blog/${slug}/index.md`]
  if (!post || !load) return undefined
  const { default: Content } = await load()
  return { post, Content, fallback: post.locale !== locale }
}
