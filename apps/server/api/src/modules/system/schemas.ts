import { z } from '@hono/zod-openapi'

export const BuildInfoSchema = z
  .object({
    version: z.string(),
    channel: z.enum(['stable', 'beta', 'development']),
    commit: z.string().optional(),
    builtAt: z.string().optional(),
    deployment: z.enum(['docker', 'docker-compose', 'kubernetes', 'source']),
  })
  .openapi('BuildInfo')

export const UpdateInfoSchema = z
  .object({
    status: z.enum(['available', 'current', 'unknown', 'disabled']),
    currentVersion: z.string(),
    latestVersion: z.string().optional(),
    releaseUrl: z.string().optional(),
    publishedAt: z.string().optional(),
    checkedAt: z.string().optional(),
    error: z.string().optional(),
  })
  .openapi('UpdateInfo')

export const SystemInfoSchema = z
  .object({
    build: BuildInfoSchema,
    update: UpdateInfoSchema,
  })
  .openapi('SystemInfo')

export const HealthSchema = z
  .object({
    status: z.literal('ok'),
    timestamp: z.number().int(),
    build: BuildInfoSchema,
  })
  .openapi('Health')

export const SystemQuerySchema = z.object({
  refresh: z.enum(['true', 'false']).optional().openapi({
    description: 'Refresh cached release information when true',
  }),
})
