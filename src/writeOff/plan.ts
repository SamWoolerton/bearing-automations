import { sumBy } from '@bearing-agency/utilities/arrays'
import { assert } from '@bearing-agency/utilities/assertions'
import {
  compareNumericAsc,
  compareStringAsc,
} from '@bearing-agency/utilities/sort'

import type { ClockifyReportTimeEntry } from '@/clients/clockify'

export type WriteOffOp =
  | { kind: 'markNonBillable'; entry: ClockifyReportTimeEntry }
  | {
      kind: 'split'
      entry: ClockifyReportTimeEntry
      billableSeconds: number
      nonBillableSeconds: number
    }

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

export type WriteOffPlan = ReturnType<typeof planWriteOff>
