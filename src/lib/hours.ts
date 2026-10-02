import { roundTo } from '@bearing-agency/utilities/numbers'

export const QUARTER_HOUR_SECONDS = 15 * 60

export const isQuarterHourMultiple = (seconds: number) =>
  Number.isInteger(seconds / QUARTER_HOUR_SECONDS)

export const formatHours = (seconds: number) =>
  String(roundTo(seconds / 3600, 2))

export function formatDuration(seconds: number) {
  const totalMinutes = Math.round(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (minutes === 0) return `${hours}h`
  return hours === 0 ? `${minutes}m` : `${hours}h${minutes}m`
}

export type Tally = { billableSeconds: number; totalSeconds: number }

export const tallyLabel = ({ billableSeconds, totalSeconds }: Tally) =>
  billableSeconds === totalSeconds
    ? formatDuration(totalSeconds)
    : `${formatDuration(billableSeconds)}/${formatDuration(totalSeconds)}`
