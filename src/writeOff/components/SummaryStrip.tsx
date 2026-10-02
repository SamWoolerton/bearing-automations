import { plural } from '@bearing-agency/utilities/strings'

import { NZD_PER_UNIT } from '@/billing/clientConfig'
import type { EarningsSummary, Rated } from '@/billing/earnings'
import { summariseEarnings } from '@/billing/earnings'
import { Card, CardContent } from '@/components/ui/card'
import { formatDollars } from '@/lib/currency'
import { billableShareLabel, formatDuration } from '@/lib/hours'
import type { Overview } from '@/writeOff/overview'
import { memberTally } from '@/writeOff/overview'

const NZD_NOTE = `NZD at ${Object.entries(NZD_PER_UNIT)
  .filter(([currency]) => currency !== 'NZD')
  .map(([currency, rate]) => `${currency} ${rate}`)
  .join(' · ')}`

const STATS: {
  label: string
  value: (summary: EarningsSummary) => string
  note?: string
}[] = [
  { label: 'Total time', value: s => formatDuration(s.totalSeconds) },
  { label: 'Billable', value: s => formatDuration(s.billableSeconds) },
  {
    label: 'Non-billable',
    value: s => formatDuration(s.totalSeconds - s.billableSeconds),
  },
  { label: 'Billable share', value: billableShareLabel },
  {
    label: 'Billable $',
    value: s => formatDollars(s.billableAmount),
    note: NZD_NOTE,
  },
  {
    label: 'Average hourly rate',
    value: s =>
      s.averageHourlyRate === null
        ? '—'
        : `${formatDollars(s.averageHourlyRate)}/h`,
    note: NZD_NOTE,
  },
]

export function SummaryStrip({
  clients,
  focusMember,
}: {
  clients: (Overview[number] & Rated)[]
  focusMember: { id: string; name: string } | undefined
}) {
  const team = summariseEarnings(clients)
  if (!team) return null
  const member =
    focusMember &&
    summariseEarnings(
      clients.flatMap(({ projects, hourlyRate }) => {
        const tally = memberTally(projects, focusMember.id)
        return tally ? [{ ...tally, hourlyRate }] : []
      }),
    )

  return (
    <section className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {focusMember
          ? `Everyone's time on ${focusMember.name}'s ${plural('client', clients.length)}`
          : `Everyone's time across ${plural('client', clients.length)}`}
      </p>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
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
              {stat.note && (
                <span className="text-xs text-muted-foreground">
                  {stat.note}
                </span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
