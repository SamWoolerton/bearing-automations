import { plural } from '@bearing-agency/utilities/strings'

import { Card, CardContent } from '@/components/ui/card'
import type { Tally } from '@/lib/hours'
import { billableShareLabel, formatDuration, sumTallies } from '@/lib/hours'
import type { Overview } from '@/writeOff/overview'
import { memberTally } from '@/writeOff/overview'

const STATS: { label: string; value: (tally: Tally) => string }[] = [
  { label: 'Total time', value: t => formatDuration(t.totalSeconds) },
  { label: 'Billable', value: t => formatDuration(t.billableSeconds) },
  {
    label: 'Non-billable',
    value: t => formatDuration(t.totalSeconds - t.billableSeconds),
  },
  { label: 'Billable share', value: billableShareLabel },
]

export function SummaryStrip({
  clients,
  focusMember,
}: {
  clients: Overview
  focusMember: { id: string; name: string } | undefined
}) {
  const team = sumTallies(clients)
  if (!team) return null
  const member =
    focusMember &&
    memberTally(
      clients.flatMap(c => c.projects),
      focusMember.id,
    )

  return (
    <section className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {focusMember
          ? `Everyone's time on ${focusMember.name}'s ${plural('client', clients.length)}`
          : `Everyone's time across ${plural('client', clients.length)}`}
      </p>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {STATS.map(stat => (
          <Card key={stat.label} className="gap-1 py-4">
            <CardContent className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">
                {stat.label}
              </span>
              <span className="text-2xl font-semibold">{stat.value(team)}</span>
              {focusMember && member && (
                <span className="text-sm text-muted-foreground">
                  {focusMember.name}: {stat.value(member)}
                </span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
