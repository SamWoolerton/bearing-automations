import { describe, expect, it } from 'vitest'

import type { ClockifyReportTimeEntry } from '@/clients/clockifySchemas'
import { HOUR_SECONDS, MINUTE_SECONDS } from '@/lib/hours'
import type { WriteOffPlan } from '@/writeOff/plan'
import { planWriteOff } from '@/writeOff/plan'

const entry = (
  id: string,
  start: string,
  duration: number,
  overrides: Partial<ClockifyReportTimeEntry> = {},
): ClockifyReportTimeEntry => ({
  _id: id,
  userId: 'user',
  userName: 'User',
  clientId: 'client',
  clientName: 'Client',
  projectId: 'project',
  projectName: 'Project',
  billable: true,
  timeInterval: {
    start,
    end: new Date(Date.parse(start) + duration * 1000).toISOString(),
    duration,
  },
  ...overrides,
})

const entries = [
  entry('mon', '2026-09-07T09:00:00.000Z', HOUR_SECONDS),
  entry('tue', '2026-09-08T09:00:00.000Z', 2 * HOUR_SECONDS),
  entry('wed', '2026-09-09T09:00:00.000Z', 1.5 * HOUR_SECONDS),
]

const summarise = (plan: WriteOffPlan) =>
  plan.ops.map(op =>
    op.kind === 'split'
      ? `${op.entry._id}: split ${op.billableSeconds}s billable / ${op.nonBillableSeconds}s non-billable`
      : `${op.entry._id}: non-billable`,
  )

describe('planWriteOff', () => {
  it('marks a single entry non-billable when it exactly covers the write-off', () => {
    expect(summarise(planWriteOff(entries, 1.5 * HOUR_SECONDS)))
      .toMatchInlineSnapshot(`
      [
        "wed: non-billable",
      ]
    `)
  })

  it('works latest first and splits the last entry needed', () => {
    expect(summarise(planWriteOff(entries, 2.75 * HOUR_SECONDS)))
      .toMatchInlineSnapshot(`
        [
          "wed: non-billable",
          "tue: split 2700s billable / 4500s non-billable",
        ]
      `)
  })

  it('marks everything non-billable when writing off all billable time', () => {
    expect(summarise(planWriteOff(entries, 4.5 * HOUR_SECONDS)))
      .toMatchInlineSnapshot(`
      [
        "wed: non-billable",
        "tue: non-billable",
        "mon: non-billable",
      ]
    `)
  })

  it('breaks start time ties by entry id', () => {
    const start = '2026-09-07T09:00:00.000Z'
    const tied = [
      entry('b', start, HOUR_SECONDS),
      entry('a', start, HOUR_SECONDS),
    ]
    expect(summarise(planWriteOff(tied, HOUR_SECONDS / 2)))
      .toMatchInlineSnapshot(`
      [
        "a: split 1800s billable / 1800s non-billable",
      ]
    `)
  })

  it.each([0, -MINUTE_SECONDS, 1.5, 4.5 * HOUR_SECONDS + 1])(
    'rejects a write-off of %ss',
    writeOffSeconds => {
      expect(() => planWriteOff(entries, writeOffSeconds)).toThrow()
    },
  )

  it('rejects non-billable entries and entries whose duration disagrees with start/end', () => {
    const nonBillable = entry('x', '2026-09-07T09:00:00.000Z', HOUR_SECONDS, {
      billable: false,
    })
    const inconsistent = entry('y', '2026-09-07T09:00:00.000Z', HOUR_SECONDS)
    inconsistent.timeInterval.duration += 1

    expect(() =>
      planWriteOff([nonBillable], MINUTE_SECONDS),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Entry x is already non-billable]`,
    )
    expect(() =>
      planWriteOff([inconsistent], MINUTE_SECONDS),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Entry y duration is 3601s but its start/end span 3600s]`,
    )
  })
})
