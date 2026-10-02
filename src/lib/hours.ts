import { roundTo } from '@bearing-agency/utilities/numbers'

export const QUARTER_HOUR_SECONDS = 15 * 60

export const isQuarterHourMultiple = (seconds: number) =>
  Number.isInteger(seconds / QUARTER_HOUR_SECONDS)

export const formatHours = (seconds: number) =>
  String(roundTo(seconds / 3600, 2))

export type Tally = { billableSeconds: number; totalSeconds: number }

export const tallyLabel = ({ billableSeconds, totalSeconds }: Tally) =>
  billableSeconds === totalSeconds
    ? formatHours(totalSeconds)
    : `${formatHours(billableSeconds)}/${formatHours(totalSeconds)}`
