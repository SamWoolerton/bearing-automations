import { sumBy } from '@bearing-agency/utilities/arrays'
import { groupSum } from '@bearing-agency/utilities/maps'
import { mapNullish, nullishDivide } from '@bearing-agency/utilities/nullish'

import type { Currency } from '@/billing/clientConfig'
import { CURRENCIES, NZD_PER_UNIT, nzdRateFor } from '@/billing/clientConfig'
import type { Tally } from '@/lib/hours'
import { HOUR_SECONDS, sumTallies } from '@/lib/hours'

export type Rated = { hourlyRate: number | null; currency: Currency | null }

export const withHourlyRates = <C extends { name: string }>(clients: C[]) =>
  clients.map(c => ({ ...c, ...nzdRateFor(c.name) }))

export function summariseEarnings(items: (Tally & Rated)[]) {
  const rated = items.flatMap(({ hourlyRate, currency, billableSeconds }) =>
    hourlyRate === null || currency === null
      ? []
      : [{ hourlyRate, currency, billableSeconds }],
  )
  const amountOf = (r: (typeof rated)[number]) =>
    (r.billableSeconds / HOUR_SECONDS) * r.hourlyRate
  const billableAmount = sumBy(rated, amountOf)
  const amountByCurrency = groupSum(rated, r => r.currency, amountOf)
  const ratedHours = sumBy(rated, r => r.billableSeconds) / HOUR_SECONDS
  return mapNullish(sumTallies(items), tally => ({
    ...tally,
    billableAmount,
    billableByCurrency: CURRENCIES.map(currency => {
      const amount = amountByCurrency.get(currency) ?? 0
      return {
        currency,
        amount,
        nativeAmount: amount / NZD_PER_UNIT[currency],
      }
    }),
    averageHourlyRate: nullishDivide(billableAmount, ratedHours),
    effectiveHourlyRate: nullishDivide(
      billableAmount,
      tally.totalSeconds / HOUR_SECONDS,
    ),
  }))
}

export type EarningsSummary = NonNullable<ReturnType<typeof summariseEarnings>>
