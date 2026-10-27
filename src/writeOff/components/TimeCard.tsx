import { cn } from 'cn'

import { LegendItem, SPLIT_COLOURS, SplitBar } from '@/components/SplitBar'
import { Card, CardContent } from '@/components/ui/card'
import type { Tally } from '@/lib/hours'
import { billableProportionLabel, formatDuration } from '@/lib/hours'

function PersonSplit({
  person,
  focused,
}: {
  person: Tally & { name: string }
  focused: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span
          className={cn(
            'truncate',
            focused ? 'font-medium' : 'text-muted-foreground',
          )}
        >
          {person.name}
        </span>
        <span className="shrink-0 text-muted-foreground tabular-nums">
          {formatDuration(person.totalSeconds)} ·{' '}
          {billableProportionLabel(person)}
        </span>
      </div>
      <SplitBar tally={person} className="h-1" />
    </div>
  )
}

export function TimeCard({
  team,
  people,
  focusMemberId,
}: {
  team: Tally
  people: (Tally & { id: string; name: string })[]
  focusMemberId: string | undefined
}) {
  return (
    <Card className="col-span-2 py-4">
      <CardContent className="flex flex-col gap-3">
        <span className="text-sm text-muted-foreground">Recorded hours</span>

        <div className="flex items-baseline justify-between gap-4">
          <span className="text-2xl font-semibold tabular-nums">
            {formatDuration(team.totalSeconds)}
          </span>
          <span className="text-sm text-muted-foreground">
            {billableProportionLabel(team)} billable
          </span>
        </div>
        <SplitBar tally={team} />

        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm">
          <LegendItem
            colour={SPLIT_COLOURS.billable}
            label="Billable"
            value={formatDuration(team.billableSeconds)}
          />
          <LegendItem
            colour={SPLIT_COLOURS.nonBillable}
            label="Non-billable"
            value={formatDuration(team.totalSeconds - team.billableSeconds)}
          />
        </div>

        <div className="mt-auto grid grid-cols-2 gap-x-5 gap-y-2.5 border-t pt-3">
          {people.map(person => (
            <PersonSplit
              key={person.id}
              person={person}
              focused={person.id === focusMemberId}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
