import { cn } from 'cn'

import type { Tally } from '@/lib/hours'
import { billablePercent } from '@/lib/hours'

export const SPLIT_COLOURS = {
  billable: 'bg-primary',
  nonBillable: 'bg-muted-foreground/20',
}

export function SplitBar({
  tally,
  className,
}: {
  tally: Tally
  className?: string
}) {
  return (
    <div
      className={cn(
        'h-2 overflow-hidden rounded-full',
        SPLIT_COLOURS.nonBillable,
        className,
      )}
    >
      <div
        className={cn('h-full rounded-full', SPLIT_COLOURS.billable)}
        style={{ width: `${billablePercent(tally) ?? 0}%` }}
      />
    </div>
  )
}
