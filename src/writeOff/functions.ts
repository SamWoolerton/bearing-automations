import { assert } from '@bearing-agency/utilities/assertions'
import { stableStringify } from '@bearing-agency/utilities/objects'

import { createServerFn } from '@tanstack/react-start'
import z from 'zod'

import { getDetailedTimeEntries } from '@/clients/clockify'
import { nowInNZ, priorMonth } from '@/lib/periods'
import {
  executeWriteOff,
  listChangeLogs,
  undoWriteOff,
} from '@/writeOff/execute'
import { buildOverview, clientsWorkedOnBy } from '@/writeOff/overview'
import { planWriteOff, writeOffPlanSchema } from '@/writeOff/plan'

const currentPeriod = () => priorMonth(nowInNZ())

export const getPriorMonthOverview = createServerFn({ method: 'GET' })
  .validator(z.object({ userId: z.string().optional() }))
  .handler(async ({ data }) => {
    const period = currentPeriod()
    const overview = buildOverview(
      await getDetailedTimeEntries({ range: period }),
    )
    return {
      period: {
        label: period.label,
        start: period.start.toISOString(),
        end: period.end.toISOString(),
      },
      clients: data.userId
        ? clientsWorkedOnBy(overview, data.userId)
        : overview,
    }
  })

const writeOffRequestSchema = z.object({
  userId: z.string(),
  projectId: z.string(),
  writeOffSeconds: z.number().int().positive(),
})

async function planFor({
  userId,
  projectId,
  writeOffSeconds,
}: z.infer<typeof writeOffRequestSchema>) {
  const entries = await getDetailedTimeEntries({
    range: currentPeriod(),
    userIds: [userId],
    projectIds: [projectId],
    billable: true,
  })
  return planWriteOff(entries, writeOffSeconds)
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
