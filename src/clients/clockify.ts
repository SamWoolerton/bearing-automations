import ky from 'ky'
import z from 'zod'

import { appendResponseBodyToError, getAllPages } from '@/clients/http'
import { env } from '@/env'

const baseApi = ky.create({
  headers: { 'X-Api-Key': env.CLOCKIFY_API_KEY },
  hooks: { beforeError: [appendResponseBodyToError] },
})

const api = baseApi.extend({
  prefix: `https://api.clockify.me/api/v1/workspaces/${env.CLOCKIFY_WORKSPACE_ID}/`,
})

const reportsApi = baseApi.extend({
  prefix: `https://reports.api.clockify.me/v1/workspaces/${env.CLOCKIFY_WORKSPACE_ID}/`,
  retry: { methods: ['post'] },
})

const clientSchema = z.object({
  id: z.string(),
  name: z.string(),
  archived: z.boolean(),
})

export function getClients() {
  return getAllPages(({ page, pageSize }) =>
    api
      .get('clients', { searchParams: { page, 'page-size': pageSize } })
      .json(z.array(clientSchema)),
  )
}

const groupSchema = z.object({
  _id: z.string(),
  name: z.string(),
  duration: z.number().int().nonnegative(),
})

const clientGroupSchema = groupSchema.extend({
  children: z.array(groupSchema),
})

export type ClockifyClientTime = z.infer<typeof clientGroupSchema>

const summaryReportSchema = z.object({
  groupOne: z.array(clientGroupSchema),
})

// Round 3.5m down and the rest up  to the nearest 15m
export function roundBillableHours(seconds: number) {
  const block = 15 * 60
  const over = seconds % block
  const rounded =
    over === 0
      ? seconds
      : over <= 3.5 * 60
        ? seconds - over
        : seconds - over + block
  return rounded / 3600
}

export async function getBillableTimeByClientAndProject({
  start,
  end,
}: {
  start: Date
  end: Date
}) {
  const report = await reportsApi
    .post('reports/summary', {
      json: {
        dateRangeStart: start.toISOString(),
        dateRangeEnd: end.toISOString(),
        billable: true,
        summaryFilter: { groups: ['CLIENT', 'PROJECT'] },
      },
    })
    .json(summaryReportSchema)
  return report.groupOne
}
