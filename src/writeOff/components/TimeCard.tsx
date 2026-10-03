import { cn } from 'cn'

import { SPLIT_COLOURS, SplitBar } from '@/components/SplitBar'
import { Card, CardContent } from '@/components/ui/card'
import type { Tally } from '@/lib/hours'
import { billableProportionLabel, formatDuration } from '@/lib/hours'

function LegendItem({
  colour,
  label,
  seconds,
}: {
  colour: string
  label: string
  seconds: number
}) {
  return (
    <span className="flex items-center gap-2">
      <span className={cn('size-2 rounded-full', colour)} />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">
        {formatDuration(seconds)}
      </span>
    </span>
  )
}

export function TimeCard({
  team,
  member,
}: {
  team: Tally
  member: (Tally & { name: string }) | undefined
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
            seconds={team.billableSeconds}
          />
          <LegendItem
            colour={SPLIT_COLOURS.nonBillable}
            label="Non-billable"
            seconds={team.totalSeconds - team.billableSeconds}
          />
        </div>

        {member && (
          <div className="flex items-center gap-3 border-t pt-3 text-sm">
            <span className="max-w-32 truncate text-muted-foreground">
              {member.name}
            </span>
            <SplitBar tally={member} className="h-1.5 flex-1" />
            <span className="font-medium tabular-nums">
              {billableProportionLabel(member)}
            </span>
            <span className="text-muted-foreground tabular-nums">
              of {formatDuration(member.totalSeconds)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
