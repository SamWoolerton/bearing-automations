import { sumBy } from '@bearing-agency/utilities/arrays'

import { cn } from 'cn'
import type { ReactNode } from 'react'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Tally } from '@/lib/hours'

export const SPLIT_COLOURS = {
  billable: 'bg-primary',
  nonBillable: 'bg-muted-foreground/20',
}

export function SegmentedBar({
  segments,
  className,
}: {
  segments: {
    key: string
    colour: string
    value: number
    tooltip?: ReactNode
  }[]
  className?: string
}) {
  const filled = segments.filter(s => s.value > 0)
  const total = sumBy(filled, s => s.value)
  return (
    <div
      className={cn(
        'flex h-2 overflow-hidden rounded-full',
        filled.length > 2 && 'gap-px',
        total === 0 && SPLIT_COLOURS.nonBillable,
        className,
      )}
    >
      {filled.map(({ key, colour, value, tooltip }) => {
        const segment = (
          <div
            key={key}
            tabIndex={tooltip ? 0 : undefined}
            className={cn('h-full', colour)}
            style={{ width: `${(100 * value) / total}%` }}
          />
        )
        return tooltip ? (
          <Tooltip key={key} disableHoverableContent>
            <TooltipTrigger asChild>{segment}</TooltipTrigger>
            <TooltipContent sideOffset={4} className="pointer-events-none">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        ) : (
          segment
        )
      })}
    </div>
  )
}

export function SplitBar({
  tally,
  className,
}: {
  tally: Tally
  className?: string
}) {
  return (
    <SegmentedBar
      className={className}
      segments={[
        {
          key: 'billable',
          colour: SPLIT_COLOURS.billable,
          value: tally.billableSeconds,
        },
        {
          key: 'nonBillable',
          colour: SPLIT_COLOURS.nonBillable,
          value: tally.totalSeconds - tally.billableSeconds,
        },
      ]}
    />
  )
}

export function LegendItem({
  colour,
  label,
  value,
  detail,
}: {
  colour: string
  label: string
  value: string
  detail?: string
}) {
  return (
    <span className="flex items-baseline gap-2">
      <span
        className={cn(
          'size-[0.5em] shrink-0 translate-y-[-0.1em] rounded-full',
          colour,
        )}
      />
      <span className="flex flex-col">
        <span className="flex items-baseline gap-2">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium tabular-nums">{value}</span>
        </span>
        {detail && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {detail}
          </span>
        )}
      </span>
    </span>
  )
}
