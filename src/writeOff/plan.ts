import { sumBy } from '@bearing-agency/utilities/arrays'
import { assert } from '@bearing-agency/utilities/assertions'
import {
  compareNumericAsc,
  compareStringAsc,
} from '@bearing-agency/utilities/sort'

import z from 'zod'

import type { ClockifyReportTimeEntry } from '@/clients/clockifySchemas'
import { reportTimeEntrySchema } from '@/clients/clockifySchemas'

const seconds = z.number().int().nonnegative()

const writeOffOpSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('markNonBillable'),
    entry: reportTimeEntrySchema,
  }),
  z.object({
    kind: z.literal('split'),
    entry: reportTimeEntrySchema,
    billableSeconds: seconds,
    nonBillableSeconds: seconds,
  }),
])

export type WriteOffOp = z.infer<typeof writeOffOpSchema>

export const writeOffPlanSchema = z.object({
  writeOffSeconds: seconds,
  availableSeconds: seconds,
  ops: z.array(writeOffOpSchema),
})

export type WriteOffPlan = z.infer<typeof writeOffPlanSchema>

const startMs = (e: ClockifyReportTimeEntry) => Date.parse(e.timeInterval.start)

const latestFirst = (a: ClockifyReportTimeEntry, b: ClockifyReportTimeEntry) =>
  compareNumericAsc(startMs(b), startMs(a)) || compareStringAsc(a._id, b._id)

export function planWriteOff(
  entries: ClockifyReportTimeEntry[],
  writeOffSeconds: number,
) {
  assert(
    Number.isInteger(writeOffSeconds) && writeOffSeconds > 0,
    `Write-off must be a positive whole number of seconds, got ${writeOffSeconds}`,
  )
  for (const e of entries) {
    assert(e.billable, `Entry ${e._id} is already non-billable`)
    const intervalSeconds = (Date.parse(e.timeInterval.end) - startMs(e)) / 1000
    assert(
      intervalSeconds === e.timeInterval.duration,
      `Entry ${e._id} duration is ${e.timeInterval.duration}s but its start/end span ${intervalSeconds}s`,
    )
  }

  const availableSeconds = sumBy(entries, e => e.timeInterval.duration)
  assert(
    writeOffSeconds <= availableSeconds,
    `Can't write off ${writeOffSeconds}s, only ${availableSeconds}s is billable`,
  )

  const ops: WriteOffOp[] = []
  let remaining = writeOffSeconds
  for (const entry of entries.toSorted(latestFirst)) {
    if (remaining === 0) break
    const { duration } = entry.timeInterval
    if (duration <= remaining) {
      ops.push({ kind: 'markNonBillable', entry })
      remaining -= duration
    } else {
      ops.push({
        kind: 'split',
        entry,
        billableSeconds: duration - remaining,
        nonBillableSeconds: remaining,
      })
      remaining = 0
    }
  }
  return { writeOffSeconds, availableSeconds, ops }
}
