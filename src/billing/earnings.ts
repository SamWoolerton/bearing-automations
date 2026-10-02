import { sumBy } from '@bearing-agency/utilities/arrays'
import { mapNullish, nullishDivide } from '@bearing-agency/utilities/nullish'

import { nzdHourlyRateFor } from '@/billing/clientConfig'
import type { Tally } from '@/lib/hours'
import { HOUR_SECONDS, sumTallies } from '@/lib/hours'

export type Rated = { hourlyRate: number | null }

export const withHourlyRates = <C extends { name: string }>(clients: C[]) =>
  clients.map(c => ({ ...c, hourlyRate: nzdHourlyRateFor(c.name) }))

export function summariseEarnings(items: (Tally & Rated)[]) {
  const rated = items.flatMap(({ hourlyRate, billableSeconds }) =>
    hourlyRate === null ? [] : [{ hourlyRate, billableSeconds }],
  )
  const billableAmount = sumBy(
    rated,
    r => (r.billableSeconds / HOUR_SECONDS) * r.hourlyRate,
  )
  const ratedHours = sumBy(rated, r => r.billableSeconds) / HOUR_SECONDS
  return mapNullish(sumTallies(items), tally => ({
    ...tally,
    billableAmount,
    averageHourlyRate: nullishDivide(billableAmount, ratedHours),
  }))
}

export type EarningsSummary = NonNullable<ReturnType<typeof summariseEarnings>>
