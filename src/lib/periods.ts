import { TZDate } from '@date-fns/tz'
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns'

export const TZ = 'Pacific/Auckland'

export const nowInNZ = () => TZDate.tz(TZ)

export function priorMonth(now: TZDate) {
  const month = subMonths(now, 1)
  return {
    start: startOfMonth(month),
    end: endOfMonth(month),
    label: format(month, 'MMMM yyyy'),
  }
}

export type Period = ReturnType<typeof priorMonth>
