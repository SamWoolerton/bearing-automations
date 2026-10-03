import { cn } from '@bearing-agency/utilities/classnames'

import type { Tally } from '@/lib/hours'
import { billableProportionLabel, formatDuration } from '@/lib/hours'

export function TallyDisplay({ tally }: { tally: Tally }) {
  const { billableSeconds, totalSeconds } = tally
  const partlyBillable = billableSeconds < totalSeconds

  return (
    <span
      className="inline-flex flex-col gap-0.5 tabular-nums"
      title={`${billableProportionLabel(tally)} billable`}
    >
      <span>
        {partlyBillable ? (
          <>
            <span className="font-medium">
              {formatDuration(billableSeconds)}
            </span>
            <span className="text-muted-foreground">
              /{formatDuration(totalSeconds)}
            </span>
          </>
        ) : (
          formatDuration(totalSeconds)
        )}
      </span>
      <span
        aria-hidden
        className={cn(
          'h-1 overflow-hidden rounded-full bg-primary/15',
          !partlyBillable && 'invisible',
        )}
      >
        {partlyBillable && (
          <span
            className="block h-full rounded-full bg-primary"
            style={{ width: `${(100 * billableSeconds) / totalSeconds}%` }}
          />
        )}
      </span>
    </span>
  )
}
