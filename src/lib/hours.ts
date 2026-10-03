import { sumBy } from '@bearing-agency/utilities/arrays'
import { roundTo } from '@bearing-agency/utilities/numbers'

export const MINUTE_SECONDS = 60
export const HOUR_SECONDS = 60 * MINUTE_SECONDS
export const QUARTER_HOUR_SECONDS = 15 * MINUTE_SECONDS

// Round 3.5m down and the rest up to the nearest 15m
export function roundBillableHours(seconds: number) {
  const over = seconds % QUARTER_HOUR_SECONDS
  const rounded =
    over === 0
      ? seconds
      : over <= 3.5 * MINUTE_SECONDS
        ? seconds - over
        : seconds - over + QUARTER_HOUR_SECONDS
  return rounded / HOUR_SECONDS
}

export const isQuarterHourMultiple = (seconds: number) =>
  Number.isInteger(seconds / QUARTER_HOUR_SECONDS)

export const formatHours = (seconds: number) =>
  String(roundTo(seconds / HOUR_SECONDS, 2))

export function formatDuration(seconds: number) {
  const totalMinutes = Math.round(seconds / MINUTE_SECONDS)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (minutes === 0) return `${hours}h`
  return hours === 0
    ? `${minutes}m`
    : `${hours}h${String(minutes).padStart(2, '0')}m`
}

export type Tally = { billableSeconds: number; totalSeconds: number }

export function sumTallies(tallies: Tally[]) {
  if (tallies.length === 0) return null
  return {
    billableSeconds: sumBy(tallies, t => t.billableSeconds),
    totalSeconds: sumBy(tallies, t => t.totalSeconds),
  }
}

export const billablePercent = ({ billableSeconds, totalSeconds }: Tally) =>
  totalSeconds === 0 ? null : (100 * billableSeconds) / totalSeconds

export function billableProportionLabel(tally: Tally) {
  const percent = billablePercent(tally)
  return percent === null ? '—' : `${Math.round(percent)}%`
}
