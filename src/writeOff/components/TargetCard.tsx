import { max } from '@bearing-agency/utilities/arrays'

import { cn } from 'cn'
import { format, parseISO } from 'date-fns'
import type { ReactNode } from 'react'

import type { TargetLineup, TargetStatus } from '@/billing/targets'
import { WEEKLY_TARGET_SECONDS } from '@/billing/targets'
import { Card, CardContent } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Tally } from '@/lib/hours'
import { formatDuration } from '@/lib/hours'

const STATUS_CLASS: Record<TargetStatus, string> = {
  met: 'bg-positive',
  missed: 'bg-negative',
  upcoming: 'bg-muted-foreground/25',
  bonus: 'bg-positive/40',
  idle: 'bg-muted',
}

const STATUS_LABEL: Record<TargetStatus, string> = {
  met: 'On target',
  missed: 'Missed',
  upcoming: 'In progress',
  bonus: 'Weekend',
  idle: 'Weekend',
}

const TARGET_HEADROOM = 1.25

type TargetTally = Tally & { targetSeconds: number; status: TargetStatus }

const formatDate = (date: string, pattern: string) =>
  format(parseISO(date), pattern)

const weekTitle = (weekStart: string) =>
  `Week of ${formatDate(weekStart, 'd MMM')}`

const formatDelta = (seconds: number) =>
  `${seconds < 0 ? '−' : '+'}${formatDuration(Math.abs(seconds))}`

const percentOf = (seconds: number, scaleSeconds: number) =>
  `${(100 * seconds) / scaleSeconds}%`

function Breakdown({ title, tally }: { title: string; tally: TargetTally }) {
  const { billableSeconds, targetSeconds, totalSeconds, status } = tally
  const rows = [
    {
      label: 'Billable',
      value: formatDuration(billableSeconds),
      note: targetSeconds > 0 && formatDelta(billableSeconds - targetSeconds),
    },
    {
      label: 'Target',
      value: targetSeconds > 0 ? formatDuration(targetSeconds) : '—',
    },
    { label: 'Worked', value: formatDuration(totalSeconds) },
  ]
  return (
    <div className="flex min-w-44 flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <span className="font-medium">{title}</span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className={cn('size-2 rounded-full', STATUS_CLASS[status])} />
          {STATUS_LABEL[status]}
        </span>
      </div>
      <dl className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-0.5 border-t pt-2 tabular-nums">
        {rows.map(({ label, value, note }) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-medium">{value}</dd>
            <dd className="text-right text-muted-foreground">{note}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function TargetTooltip({
  title,
  tally,
  span = 1,
  className,
  children,
}: {
  title: string
  tally: TargetTally
  span?: number
  className: string
  children?: ReactNode
}) {
  return (
    <Tooltip disableHoverableContent>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-label={`${title}: ${formatDuration(tally.billableSeconds)} billable`}
          className={className}
          style={{ gridColumn: `span ${span}` }}
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent variant="card">
        <Breakdown title={title} tally={tally} />
      </TooltipContent>
    </Tooltip>
  )
}

const columnsFor = (count: number) => ({
  gridTemplateColumns: `repeat(${count}, 1fr)`,
})

function MiniBarChart({
  bars,
  className,
}: {
  bars: { key: string; title: string; tally: TargetTally }[]
  className: string
}) {
  const scaleSeconds = Math.max(
    max(bars.map(b => b.tally.billableSeconds)) ?? 0,
    TARGET_HEADROOM * (max(bars.map(b => b.tally.targetSeconds)) ?? 0),
  )
  return (
    <div
      className={cn('grid gap-x-px', className)}
      style={columnsFor(bars.length)}
    >
      {bars.map(({ key, title, tally }) => (
        <TargetTooltip
          key={key}
          title={title}
          tally={tally}
          className="relative flex h-full items-end"
        >
          <span
            className={cn(
              'min-h-0.5 w-full rounded-t-[1px]',
              STATUS_CLASS[tally.status],
            )}
            style={{ height: percentOf(tally.billableSeconds, scaleSeconds) }}
          />
          {tally.targetSeconds > 0 && (
            <span
              className="pointer-events-none absolute -inset-x-px border-t border-dashed border-foreground/50"
              style={{ bottom: percentOf(tally.targetSeconds, scaleSeconds) }}
            />
          )}
        </TargetTooltip>
      ))}
    </div>
  )
}

function CumulativeChart({
  lineup: { cumulative, monthToDate },
  className,
}: {
  lineup: TargetLineup
  className: string
}) {
  const elapsed = cumulative.filter(p => p.elapsed)
  const scaleSeconds = Math.max(
    cumulative.at(-1)?.targetSeconds ?? 0,
    elapsed.at(-1)?.billableSeconds ?? 0,
  )
  const pointsFor = (
    points: typeof cumulative,
    seconds: (point: (typeof cumulative)[number]) => number,
  ) =>
    [
      '0,100',
      ...points.map(
        (p, i) =>
          `${(100 * (i + 1)) / cumulative.length},${100 - (100 * seconds(p)) / scaleSeconds}`,
      ),
    ].join(' ')

  return (
    <TargetTooltip
      title="Month to date"
      tally={monthToDate}
      className={cn('relative min-h-0', className)}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full overflow-visible"
      >
        <polyline
          points={pointsFor(cumulative, p => p.targetSeconds)}
          fill="none"
          className="stroke-foreground/50"
          strokeWidth={1}
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={pointsFor(elapsed, p => p.billableSeconds)}
          fill="none"
          className={
            monthToDate.status === 'met' ? 'stroke-positive' : 'stroke-negative'
          }
          strokeWidth={2}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </TargetTooltip>
  )
}

function ChartCaption({ children }: { children: ReactNode }) {
  return <span className="text-xs text-muted-foreground">{children}</span>
}

export function TargetCard({ lineup }: { lineup: TargetLineup }) {
  const { weeks } = lineup
  const days = weeks.flatMap(w => w.days)
  const scored = weeks.filter(w => w.status === 'met' || w.status === 'missed')
  const met = scored.filter(w => w.status === 'met').length

  return (
    <Card className="py-4">
      <CardContent className="flex h-full flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2 text-sm text-muted-foreground">
          <span>Billable target</span>
          <span className="tabular-nums">
            {formatDuration(WEEKLY_TARGET_SECONDS)}/wk
          </span>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-2xl font-semibold tabular-nums">
            {scored.length === 0 ? '—' : `${met}/${scored.length}`}
          </span>
          <span className="text-sm text-muted-foreground">weeks on target</span>
        </div>

        <div
          className="mt-auto grid gap-x-px gap-y-1 pt-3"
          style={columnsFor(days.length)}
        >
          <MiniBarChart
            className="col-span-full h-12"
            bars={days.map(day => ({
              key: day.date,
              title: formatDate(day.date, 'EEE d MMM'),
              tally: day,
            }))}
          />
          {weeks.map(week => (
            <TargetTooltip
              key={week.weekStart}
              title={weekTitle(week.weekStart)}
              tally={week}
              span={week.days.length}
              className={cn('h-1.5 rounded-[1px]', STATUS_CLASS[week.status])}
            />
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatDate(days[0].date, 'd MMM')}</span>
          <span>{formatDate(days[days.length - 1].date, 'd MMM')}</span>
        </div>

        <div className="mt-2 flex h-20 gap-3 border-t pt-3">
          <div className="flex w-16 flex-col gap-1">
            <MiniBarChart
              className="flex-1 gap-x-0.5"
              bars={weeks.map(week => ({
                key: week.weekStart,
                title: weekTitle(week.weekStart),
                tally: week,
              }))}
            />
            <ChartCaption>Weeks</ChartCaption>
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <CumulativeChart className="flex-1" lineup={lineup} />
            <ChartCaption>Month to date</ChartCaption>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
