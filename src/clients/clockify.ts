import { unique } from '@bearing-agency/utilities/arrays'
import { assert } from '@bearing-agency/utilities/assertions'

import ky from 'ky'
import z from 'zod'

import { reportTimeEntrySchema } from '@/clients/clockifySchemas'
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

const summaryGroupSchema = z.object({
  _id: z.string(),
  name: z.string(),
  duration: z.number().int().nonnegative(),
})

const withChildren = <T extends z.ZodType>(child: T) =>
  summaryGroupSchema.extend({ children: z.array(child) })

const clientProjectSchema = withChildren(summaryGroupSchema)

export type ClockifyClientTime = z.infer<typeof clientProjectSchema>

const clientProjectUserSchema = withChildren(clientProjectSchema)

export type ClockifyClientProjectUserTime = z.infer<
  typeof clientProjectUserSchema
>

type DateRange = { start: Date; end: Date }

const toUtcIso = (date: Date) => new Date(date.getTime()).toISOString()

const reportDateRange = ({ start, end }: DateRange) => ({
  dateRangeStart: toUtcIso(start),
  dateRangeEnd: toUtcIso(end),
})

const containsIds = (ids: string[]) => ({
  ids,
  contains: 'CONTAINS',
  status: 'ALL',
})

async function getSummary<T extends z.ZodType>({
  range,
  groups,
  groupSchema,
  billable,
}: {
  range: DateRange
  groups: string[]
  groupSchema: T
  billable?: boolean
}) {
  const report = await reportsApi
    .post('reports/summary', {
      json: {
        ...reportDateRange(range),
        billable,
        summaryFilter: { groups },
      },
    })
    .json(z.object({ groupOne: z.array(groupSchema) }))
  return report.groupOne
}

export const getBillableTimeByClientAndProject = (range: DateRange) =>
  getSummary({
    range,
    groups: ['CLIENT', 'PROJECT'],
    groupSchema: clientProjectSchema,
    billable: true,
  })

export const getTimeByClientProjectAndUser = ({
  range,
  billable,
}: {
  range: DateRange
  billable?: boolean
}) =>
  getSummary({
    range,
    groups: ['CLIENT', 'PROJECT', 'USER'],
    groupSchema: clientProjectUserSchema,
    billable,
  })

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
          users: userIds && containsIds(userIds),
          projects: projectIds && containsIds(projectIds),
          billable,
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

export const timeEntryInputSchema = z.object({
  start: z.iso.datetime(),
  end: z.iso.datetime(),
  billable: z.boolean(),
  description: z.string(),
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
})

export type ClockifyTimeEntryInput = z.infer<typeof timeEntryInputSchema>

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
