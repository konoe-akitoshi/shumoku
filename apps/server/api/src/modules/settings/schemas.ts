import { z } from '@hono/zod-openapi'

export const SettingsSchema = z.record(z.string(), z.string()).openapi('Settings')
export const SettingSchema = z.object({ key: z.string(), value: z.string() }).openapi('Setting')
export const SettingValueSchema = z.object({ value: z.string() }).openapi('SettingValue')
export const SettingKeyParamsSchema = z.object({
  key: z
    .string()
    .min(1)
    .openapi({ param: { name: 'key', in: 'path' } }),
})
export const SettingsSuccessSchema = z
  .object({ success: z.literal(true) })
  .openapi('SettingsSuccess')
