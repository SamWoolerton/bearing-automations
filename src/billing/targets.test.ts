import { TZDate } from '@date-fns/tz'
import { describe, expect, it } from 'vitest'

import {
  buildTargetLineup,
  DAILY_TARGET_SECONDS,
  tallyByDate,
} from '@/billing/targets'
import type { ClockifyDateClientProjectTime } from '@/clients/clockify'
import { HOUR_SECONDS } from '@/lib/hours'
import { monthPeriod, TZ } from '@/lib/periods'

const OCTOBER = monthPeriod(new TZDate(2026, 9, 1, TZ))
const AFTER_OCTOBER = '2026-11-01'

const group = (name: string, duration: number) => ({
  _id: name,
  name,
  duration,
})

const billableOnly = (entries: [string, number][]) =>
  new Map(
    entries.map(([date, seconds]) => [
      date,
      { billableSeconds: seconds, totalSeconds: seconds },
    ]),
  )

describe('tallyByDate', () => {
  const dates: ClockifyDateClientProjectTime[] = [
    {
      ...group('2026-10-01', 0),
      children: [
        { ...group('Acme', 0), children: [group('App', 3 * HOUR_SECONDS)] },
        {
          ...group('Bearing', 0),
          children: [group('Admin', HOUR_SECONDS)],
        },
        {
          ...group('', 0),
          children: [
            group('Internal', HOUR_SECONDS),
            group('Prototype', 2 * HOUR_SECONDS),
          ],
        },
      ],
    },
  ]

  it('counts Bearing and unassigned Internal time as worked but not billable', () => {
    expect(tallyByDate(dates, dates)).toEqual(
      new Map([
        [
          '2026-10-01',
          { billableSeconds: 5 * HOUR_SECONDS, totalSeconds: 7 * HOUR_SECONDS },
        ],
      ]),
    )
  })

  it('throws when a day has more billable than total time', () => {
    expect(() => tallyByDate([], dates)).toThrowErrorMatchingInlineSnapshot(`[Error: 2026-10-01 has more billable (18000s) than total (0s) time]`)
  })
})

describe('buildTargetLineup', () => {
  it('splits the month into Monday weeks with targets pro-rated to weekdays', () => {
    const { weeks } = buildTargetLineup(OCTOBER, new Map(), AFTER_OCTOBER)
    expect(
      weeks.map(w => [w.weekStart, w.targetSeconds / HOUR_SECONDS]),
    ).toEqual([
      ['2026-09-28', 24],
      ['2026-10-05', 60],
      ['2026-10-12', 60],
      ['2026-10-19', 60],
      ['2026-10-26', 60],
    ])
  })

  it('counts weekend hours as bonus towards the week', () => {
    const {
      weeks: [week],
    } = buildTargetLineup(
      OCTOBER,
      billableOnly([
        ['2026-10-01', DAILY_TARGET_SECONDS],
        ['2026-10-02', 10 * HOUR_SECONDS],
        ['2026-10-03', 2 * HOUR_SECONDS],
      ]),
      AFTER_OCTOBER,
    )
    expect(week.days.map(d => [d.date, d.status])).toEqual([
      ['2026-10-01', 'met'],
      ['2026-10-02', 'missed'],
      ['2026-10-03', 'bonus'],
      ['2026-10-04', 'idle'],
    ])
    expect(week.status).toBe('met')
  })

  it("marks today and later as upcoming until they're met", () => {
    const {
      weeks: [week],
    } = buildTargetLineup(
      OCTOBER,
      billableOnly([['2026-10-01', 13 * HOUR_SECONDS]]),
      '2026-10-02',
    )
    expect(week.days.map(d => d.status)).toEqual([
      'met',
      'upcoming',
      'idle',
      'idle',
    ])
    expect(week.status).toBe('upcoming')
  })

  it('accumulates through the month and tracks month to date up to today', () => {
    const { cumulative, monthToDate } = buildTargetLineup(
      OCTOBER,
      billableOnly([
        ['2026-10-01', 10 * HOUR_SECONDS],
        ['2026-10-02', 15 * HOUR_SECONDS],
        ['2026-10-05', 8 * HOUR_SECONDS],
      ]),
      '2026-10-05',
    )
    expect(
      cumulative
        .slice(0, 6)
        .map(p => [
          p.date,
          p.elapsed,
          p.billableSeconds / HOUR_SECONDS,
          p.targetSeconds / HOUR_SECONDS,
        ]),
    ).toEqual([
      ['2026-10-01', true, 10, 12],
      ['2026-10-02', true, 25, 24],
      ['2026-10-03', true, 25, 24],
      ['2026-10-04', true, 25, 24],
      ['2026-10-05', true, 33, 36],
      ['2026-10-06', false, 33, 48],
    ])
    expect(monthToDate).toMatchObject({
      billableSeconds: 33 * HOUR_SECONDS,
      targetSeconds: 36 * HOUR_SECONDS,
      status: 'upcoming',
    })
  })

  it('throws on time outside the month', () => {
    expect(() =>
      buildTargetLineup(
        OCTOBER,
        billableOnly([['2026-11-01', HOUR_SECONDS]]),
        AFTER_OCTOBER,
      ),
    ).toThrowErrorMatchingInlineSnapshot(`[Error: Clockify reported time on 2026-11-01, outside October 2026]`)
  })
})
