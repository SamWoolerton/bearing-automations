import { unique } from '@bearing-agency/utilities/arrays'
import { assert } from '@bearing-agency/utilities/assertions'

import ky from 'ky'
import z from 'zod'

import { appendResponseBodyToError, getAllPages } from '@/clients/http'
import { env } from '@/env'

const baseApi = ky.create({
  headers: { 'X-Api-Key': env.CLOCKIFY_API_KEY },
  hooks: { beforeError: [appendResponseBodyToError] },
})

// No DELETE retries: a retry after a delete that landed would 404 and report a false failure
const api = baseApi.extend({
  prefix: `https://api.clockify.me/api/v1/workspaces/${env.CLOCKIFY_WORKSPACE_ID}/`,
  retry: { methods: ['get', 'put'] },
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

type DateRange = { start: Date; end: Date }

const reportDateRange = ({ start, end }: DateRange) => ({
  dateRangeStart: start.toISOString(),
  dateRangeEnd: end.toISOString(),
})

const containsIds = (ids: string[]) => ({
  ids,
  contains: 'CONTAINS',
  status: 'ALL',
})

export async function getBillableTimeByClientAndProject(range: DateRange) {
  const report = await reportsApi
    .post('reports/summary', {
      json: {
        ...reportDateRange(range),
        billable: true,
        summaryFilter: { groups: ['CLIENT', 'PROJECT'] },
      },
    })
    .json(summaryReportSchema)
  return report.groupOne
}

const reportTimeEntrySchema = z.object({
  _id: z.string(),
  userId: z.string(),
  userName: z.string(),
  clientId: z.string().nullish(),
  clientName: z.string().nullish(),
  projectId: z.string().nullish(),
  projectName: z.string().nullish(),
  billable: z.boolean(),
  timeInterval: z.object({
    start: z.iso.datetime({ offset: true }),
    end: z.iso.datetime({ offset: true }),
    duration: z.number().int().nonnegative(),
  }),
})

export type ClockifyReportTimeEntry = z.infer<typeof reportTimeEntrySchema>

export async function getDetailedTimeEntries({
  range,
  userIds,
  projectIds,
  billable,
}: {
  range: DateRange
  userIds?: string[]
  projectIds?: string[]
  billable?: boolean
}) {
  const entries = await getAllPages(async ({ page, pageSize }) => {
    const report = await reportsApi
      .post('reports/detailed', {
        json: {
          ...reportDateRange(range),
          exportType: 'JSON',
          detailedFilter: { page, pageSize, sortColumn: 'DATE' },
          ...(userIds && { users: containsIds(userIds) }),
          ...(projectIds && { projects: containsIds(projectIds) }),
          ...(billable !== undefined && { billable }),
        },
      })
      .json(z.object({ timeentries: z.array(reportTimeEntrySchema) }))
    return report.timeentries
  })
  assert(
    unique(entries.map(e => e._id)).length === entries.length,
    'Clockify detailed report returned duplicate entries — entries changed while paging, try again',
  )
  return entries
}

const timeEntrySchema = z.object({
  id: z.string(),
  userId: z.string(),
  description: z.string(),
  billable: z.boolean(),
  isLocked: z.boolean(),
  projectId: z.string().nullable(),
  taskId: z.string().nullable(),
  tagIds: z.array(z.string()).nullable(),
  customFieldValues: z.array(z.unknown()).optional(),
  timeInterval: z.object({
    start: z.iso.datetime(),
    end: z.iso.datetime(),
  }),
})

export type ClockifyTimeEntry = z.infer<typeof timeEntrySchema>

export type ClockifyTimeEntryInput = {
  start: string
  end: string
  billable: boolean
  description: string
  projectId?: string
  taskId?: string
  tagIds?: string[]
}

export const toTimeEntryInput = (entry: ClockifyTimeEntry) => ({
  start: entry.timeInterval.start,
  end: entry.timeInterval.end,
  billable: entry.billable,
  description: entry.description,
  projectId: entry.projectId ?? undefined,
  taskId: entry.taskId ?? undefined,
  tagIds: entry.tagIds ?? undefined,
})

export function getTimeEntry(id: string) {
  return api.get(`time-entries/${id}`).json(timeEntrySchema)
}

export function updateTimeEntry(id: string, input: ClockifyTimeEntryInput) {
  return api.put(`time-entries/${id}`, { json: input }).json(timeEntrySchema)
}

export function createTimeEntryForUser(
  userId: string,
  input: ClockifyTimeEntryInput,
) {
  return api
    .post(`user/${userId}/time-entries`, { json: input })
    .json(timeEntrySchema)
}

export async function deleteTimeEntry(id: string) {
  await api.delete(`time-entries/${id}`)
}
