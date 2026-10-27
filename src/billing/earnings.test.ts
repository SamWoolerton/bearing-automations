import { describe, expect, it } from 'vitest'

import { summariseEarnings } from '@/billing/earnings'
import { HOUR_SECONDS } from '@/lib/hours'

const hours = (billable: number, total = billable) => ({
  billableSeconds: billable * HOUR_SECONDS,
  totalSeconds: total * HOUR_SECONDS,
})

describe('summariseEarnings', () => {
  it('splits the NZD billable amount by client currency', () => {
    const summary = summariseEarnings([
      { ...hours(2), hourlyRate: 100, currency: 'NZD' },
      { ...hours(1, 3), hourlyRate: 200, currency: 'USD' },
      { ...hours(3), hourlyRate: 50, currency: 'USD' },
      { ...hours(4), hourlyRate: null, currency: null },
    ])
    expect(summary?.billableByCurrency).toMatchInlineSnapshot(`
      [
        {
          "amount": 200,
          "currency": "NZD",
          "nativeAmount": 200,
        },
        {
          "amount": 350,
          "currency": "USD",
          "nativeAmount": 202.3121387283237,
        },
        {
          "amount": 0,
          "currency": "AUD",
          "nativeAmount": 0,
        },
        {
          "amount": 0,
          "currency": "CAD",
          "nativeAmount": 0,
        },
      ]
    `)
    expect(summary?.billableAmount).toMatchInlineSnapshot(`550`)
  })
})
