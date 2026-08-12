import { z } from '@hono/zod-openapi'

export const DataSourceSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    configJson: z.string(),
    status: z.enum(['connected', 'disconnected', 'unknown']),
    statusMessage: z.string().optional(),
    lastCheckedAt: z.number().int().optional(),
    failCount: z.number().int(),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
  })
  .openapi('DataSource')

export const DataSourceListSchema = z.array(DataSourceSchema).openapi('DataSourceList')

export const DataSourceIdParamsSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({ param: { name: 'id', in: 'path' } }),
})

export const CreateDataSourceSchema = z
  .object({
    name: z.string().min(1),
    type: z.string().min(1),
    configJson: z.string().min(1),
  })
  .openapi('CreateDataSource')

export const UpdateDataSourceSchema = CreateDataSourceSchema.partial().openapi('UpdateDataSource')

export const DeleteDataSourceResultSchema = z
  .object({ success: z.literal(true) })
  .openapi('DeleteDataSourceResult')
