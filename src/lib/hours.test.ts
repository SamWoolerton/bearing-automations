import { describe, expect, it } from 'vitest'

import {
  HOUR_SECONDS,
  MINUTE_SECONDS,
  QUARTER_HOUR_SECONDS,
  roundBillableHours,
} from '@/lib/hours'

describe('roundBillableHours', () => {
  it.each([
    [0, 0],
    [MINUTE_SECONDS, 0],
    [QUARTER_HOUR_SECONDS - 1, 0.25],
    [QUARTER_HOUR_SECONDS, 0.25],
    [QUARTER_HOUR_SECONDS + 3.5 * MINUTE_SECONDS, 0.25],
    [QUARTER_HOUR_SECONDS + 3.5 * MINUTE_SECONDS + 1, 0.5],
    [7 * HOUR_SECONDS + 1, 7],
  ])('rounds %ss to %sh', (seconds, hours) => {
    expect(roundBillableHours(seconds)).toBe(hours)
  })
})
