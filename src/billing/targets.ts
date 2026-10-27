import { sumBy } from '@bearing-agency/utilities/arrays'
import { assert } from '@bearing-agency/utilities/assertions'

import { eachDayOfInterval, isWeekend, startOfWeek } from 'date-fns'

import type { ClockifyDateClientProjectTime } from '@/clients/clockify'
import type { Tally } from '@/lib/hours'
import { HOUR_SECONDS } from '@/lib/hours'
import type { Period } from '@/lib/periods'
import { isoDate } from '@/lib/periods'
import { isBearingTime } from '@/writeOff/overview'

export const WEEKLY_TARGET_SECONDS = 60 * HOUR_SECONDS
const WORKDAYS_PER_WEEK = 5
export const DAILY_TARGET_SECONDS = WEEKLY_TARGET_SECONDS / WORKDAYS_PER_WEEK

function secondsByDate(
  dates: ClockifyDateClientProjectTime[],
  counts: (clientName: string, projectName: string) => boolean,
) {
  const byDate = new Map(
    dates.map(date => [
      date._id,
      sumBy(date.children, client =>
        sumBy(
          client.children.filter(p => counts(client.name, p.name)),
          p => p.duration,
        ),
      ),
    ]),
  )
  assert(
    byDate.size === dates.length,
    `Duplicate Clockify report dates: ${dates.map(d => d._id).join(', ')}`,
  )
  return byDate
}

export function tallyByDate(
  all: ClockifyDateClientProjectTime[],
  billable: ClockifyDateClientProjectTime[],
) {
  const totals = secondsByDate(all, () => true)
  const billables = secondsByDate(
    billable,
    (clientName, projectName) => !isBearingTime(clientName, projectName),
  )
  for (const [date, billableSeconds] of billables) {
    const totalSeconds = totals.get(date) ?? 0
    assert(
      billableSeconds <= totalSeconds,
      `${date} has more billable (${billableSeconds}s) than total (${totalSeconds}s) time`,
    )
  }
  return new Map(
    [...totals].map(([date, totalSeconds]) => [
      date,
      { billableSeconds: billables.get(date) ?? 0, totalSeconds },
    ]),
  )
}

export type TargetStatus = 'met' | 'missed' | 'upcoming' | 'bonus' | 'idle'

type TargetTally = { billableSeconds: number; targetSeconds: number }

function withStatus<T extends TargetTally>(tally: T, finished: boolean) {
  const { billableSeconds, targetSeconds } = tally
  const status: TargetStatus =
    targetSeconds === 0
      ? billableSeconds > 0
        ? 'bonus'
        : 'idle'
      : billableSeconds >= targetSeconds
        ? 'met'
        : finished
          ? 'missed'
          : 'upcoming'
  return { ...tally, status }
}

export function buildTargetLineup(
  { start, end, label }: Period,
  tallies: Map<string, Tally>,
  today: string,
) {
  const days = eachDayOfInterval({ start, end }).map(day => {
    const date = isoDate(day)
    return withStatus(
      {
        date,
        weekStart: isoDate(startOfWeek(day, { weekStartsOn: 1 })),
        billableSeconds: tallies.get(date)?.billableSeconds ?? 0,
        totalSeconds: tallies.get(date)?.totalSeconds ?? 0,
        targetSeconds: isWeekend(day) ? 0 : DAILY_TARGET_SECONDS,
      },
      date < today,
    )
  })
  for (const date of tallies.keys())
    assert(
      days.some(d => d.date === date),
      `Clockify reported time on ${date}, outside ${label}`,
    )

  const summarise = (subset: typeof days) =>
    withStatus(
      {
        billableSeconds: sumBy(subset, d => d.billableSeconds),
        totalSeconds: sumBy(subset, d => d.totalSeconds),
        targetSeconds: sumBy(subset, d => d.targetSeconds),
      },
      subset.every(d => d.date < today),
    )

  return {
    weeks: [...Map.groupBy(days, d => d.weekStart)].map(
      ([weekStart, weekDays]) => ({
        weekStart,
        days: weekDays,
        ...summarise(weekDays),
      }),
    ),
    cumulative: days.map((day, i) => ({
      date: day.date,
      elapsed: day.date <= today,
      ...summarise(days.slice(0, i + 1)),
    })),
    monthToDate: summarise(days.filter(d => d.date <= today)),
  }
}

export type TargetLineup = ReturnType<typeof buildTargetLineup>
