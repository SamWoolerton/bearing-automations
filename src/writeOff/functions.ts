import { sumBy } from '@bearing-agency/utilities/arrays'
import { assert } from '@bearing-agency/utilities/assertions'
import { stableStringify } from '@bearing-agency/utilities/objects'

import { createServerFn } from '@tanstack/react-start'
import z from 'zod'

import { withHourlyRates } from '@/billing/earnings'
import {
  getDetailedTimeEntries,
  getTimeByClientProjectAndUser,
} from '@/clients/clockify'
import { formatHours, isQuarterHourMultiple } from '@/lib/hours'
import { nowInNZ, priorMonth } from '@/lib/periods'
import {
  executeWriteOff,
  listChangeLogs,
  undoWriteOff,
} from '@/writeOff/execute'
import {
  buildOverview,
  clientsWorkedOnBy,
  membersIn,
} from '@/writeOff/overview'
import { planWriteOff, writeOffPlanSchema } from '@/writeOff/plan'

const currentPeriod = () => priorMonth(nowInNZ())

export const getPriorMonthOverview = createServerFn({ method: 'GET' })
  .validator(z.object({ userId: z.string().optional() }))
  .handler(async ({ data }) => {
    const period = currentPeriod()
    const [all, billable] = await Promise.all([
      getTimeByClientProjectAndUser({ range: period }),
      getTimeByClientProjectAndUser({ range: period, billable: true }),
    ])
    const overview = withHourlyRates(buildOverview(all, billable))
    return {
      period: {
        label: period.label,
        start: period.start.toISOString(),
        end: period.end.toISOString(),
      },
      members: membersIn(overview),
      clients: data.userId
        ? clientsWorkedOnBy(overview, data.userId)
        : overview,
    }
  })

const writeOffRequestSchema = z.object({
  userId: z.string(),
  projectId: z.string(),
  targetBillableSeconds: z
    .number()
    .int()
    .nonnegative()
    .refine(isQuarterHourMultiple, 'Must be in 15 minute steps'),
})

export type WriteOffRequest = z.infer<typeof writeOffRequestSchema>

async function planFor({
  userId,
  projectId,
  targetBillableSeconds,
}: WriteOffRequest) {
  const entries = await getDetailedTimeEntries({
    range: currentPeriod(),
    userIds: [userId],
    projectIds: [projectId],
    billable: true,
  })
  const billableSeconds = sumBy(entries, e => e.timeInterval.duration)
  assert(
    targetBillableSeconds < billableSeconds,
    `Only ${formatHours(billableSeconds)}h is billable, so there's nothing to write off to reach ${formatHours(targetBillableSeconds)}h`,
  )
  return planWriteOff(entries, billableSeconds - targetBillableSeconds)
}

export const prepareWriteOff = createServerFn({ method: 'GET' })
  .validator(writeOffRequestSchema)
  .handler(({ data }) => planFor(data))

export const confirmWriteOff = createServerFn({ method: 'POST' })
  .validator(
    writeOffRequestSchema.extend({ confirmedPlan: writeOffPlanSchema }),
  )
  .handler(async ({ data: { confirmedPlan, ...request } }) => {
    const plan = await planFor(request)
    assert(
      stableStringify(plan) === stableStringify(confirmedPlan),
      'Clockify has changed since this plan was prepared — nothing written, review the new plan',
    )
    return executeWriteOff(plan)
  })

export const getWriteOffLogs = createServerFn({ method: 'GET' }).handler(() =>
  listChangeLogs(),
)

export const undoWriteOffById = createServerFn({ method: 'POST' })
  .validator(z.object({ logId: z.string() }))
  .handler(({ data }) => undoWriteOff(data.logId))
