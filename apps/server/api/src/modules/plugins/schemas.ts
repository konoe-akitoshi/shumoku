import { z } from '@hono/zod-openapi'
import { PluginConfigSchema } from '../data-sources/schemas.js'

export const PluginIdParamsSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({ param: { name: 'id', in: 'path' } }),
})

export const PluginInfoSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    version: z.string(),
    path: z.string(),
    capabilities: z.array(z.string()),
    configSchema: PluginConfigSchema.optional(),
    optionsSchema: PluginConfigSchema.optional(),
    enabled: z.boolean(),
    bundled: z.boolean(),
    error: z.string().optional(),
  })
  .openapi('PluginInfo')

export const PluginListSchema = z.array(PluginInfoSchema).openapi('PluginList')

export const PluginManifestSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    version: z.string(),
    description: z.string().optional(),
    capabilities: z.array(z.string()),
    entry: z.string().optional(),
    configSchema: PluginConfigSchema.optional(),
    optionsSchema: PluginConfigSchema.optional(),
  })
  .openapi('PluginManifest')

export const InstallPluginJsonSchema = z
  .object({
    path: z.string().min(1).optional(),
    url: z.url().optional(),
    subdirectory: z.string().min(1).optional(),
  })
  .refine(
    (input: { path?: string; url?: string }) => (input.path ? 1 : 0) + (input.url ? 1 : 0) === 1,
    {
      message: 'Exactly one of path or url is required',
    },
  )
  .openapi('InstallPlugin')

export const InstallPluginFormSchema = z.object({
  file: z
    .custom<File>((value: unknown) => value instanceof File)
    .openapi({ type: 'string', format: 'binary' }),
  subdirectory: z.string().min(1).optional(),
})

export const SetPluginEnabledSchema = z.object({ enabled: z.boolean() }).openapi('SetPluginEnabled')

export const DeletePluginQuerySchema = z.object({ deleteFiles: z.stringbool().default(false) })

export const PluginSuccessSchema = z.object({ success: z.literal(true) }).openapi('PluginSuccess')

export const ReloadPluginsResultSchema = z
  .object({ success: z.literal(true), plugins: PluginListSchema, count: z.number().int() })
  .openapi('ReloadPluginsResult')
