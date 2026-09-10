import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

const guides = defineCollection({
  loader: glob({
    base: new URL('../../..', import.meta.url),
    pattern: 'apps/*/{docs,web/src/routes}/**/*.guide.{en,ja}.md',
    generateId: ({ data }) => `${String(data['locale'])}/${String(data['slug'])}`,
  }),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    locale: z.enum(['en', 'ja']),
    canonicalLocale: z.enum(['en', 'ja']),
    slug: z.string(),
    status: z.enum(['stable', 'preview', 'deprecated']),
    audience: z.enum(['user', 'operator', 'maintainer']),
    owner: z.string(),
    journey: z.string().optional(),
    journeyFile: z.string().optional(),
    canonicalDigest: z.string().optional(),
    related: z.array(z.string()).default([]),
  }),
})

export const collections = { guides }
