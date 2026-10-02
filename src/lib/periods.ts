import { TZDate } from '@date-fns/tz'
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns'

export const TZ = 'Pacific/Auckland'

export const nowInNZ = () => TZDate.tz(TZ)

export function monthPeriod(month: TZDate) {
  return {
    key: format(month, 'yyyy-MM'),
    start: startOfMonth(month),
    end: endOfMonth(month),
    label: format(month, 'MMMM yyyy'),
  }
}

export const priorMonth = (now: TZDate) => monthPeriod(subMonths(now, 1))

export const selectableMonths = (now: TZDate) => [
  priorMonth(now),
  monthPeriod(now),
]

export type Period = ReturnType<typeof monthPeriod>
