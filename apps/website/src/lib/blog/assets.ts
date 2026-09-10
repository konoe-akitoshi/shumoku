const assets = import.meta.glob<string>('/src/content/blog/*/images/*', {
  eager: true,
  query: '?url',
  import: 'default',
})

export function articleAsset(slug: string, source: string): string {
  if (!source.startsWith('./')) return source
  const url = assets[`/src/content/blog/${slug}/${source.slice(2)}`]
  if (!url) throw new Error(`Missing article image: ${slug}/${source}`)
  return url
}
