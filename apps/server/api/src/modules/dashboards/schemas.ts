import { z } from '@hono/zod-openapi'

export const DashboardSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    layoutJson: z.string(),
    shareToken: z.string().optional(),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
  })
  .openapi('Dashboard')

export const DashboardListSchema = z.array(DashboardSchema).openapi('DashboardList')

export const DashboardIdParamsSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({ param: { name: 'id', in: 'path' } }),
})

export const CreateDashboardSchema = z
  .object({ name: z.string().min(1), layoutJson: z.string().optional() })
  .openapi('CreateDashboard')

export const UpdateDashboardSchema = CreateDashboardSchema.partial().openapi('UpdateDashboard')

export const DashboardShareResultSchema = z
  .object({ shareToken: z.string() })
  .openapi('DashboardShareResult')

export const SuccessSchema = z.object({ success: z.literal(true) }).openapi('Success')
