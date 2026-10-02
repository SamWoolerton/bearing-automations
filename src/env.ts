import z from 'zod'

export const env = z
  .object({
    CLOCKIFY_API_KEY: z.string().min(1),
    CLOCKIFY_WORKSPACE_ID: z.string().min(1),
    XERO_CLIENT_ID: z.string().min(1),
    XERO_CLIENT_SECRET: z.string().min(1),
    DRY_RUN: z
      .enum(['true', 'false'])
      .default('true')
      .transform(v => v === 'true'),
  })
  .parse(process.env)
