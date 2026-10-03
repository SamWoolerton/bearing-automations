import { mapNullish } from '@bearing-agency/utilities/nullish'
import { plural } from '@bearing-agency/utilities/strings'

import { NZD_PER_UNIT } from '@/billing/clientConfig'
import type { EarningsSummary, Rated } from '@/billing/earnings'
import { summariseEarnings } from '@/billing/earnings'
import { Card, CardContent } from '@/components/ui/card'
import { formatDollars } from '@/lib/currency'
import { TimeCard } from '@/writeOff/components/TimeCard'
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
    mapNullish(
      summariseEarnings(
        clients.flatMap(({ projects, hourlyRate }) => {
          const tally = memberTally(projects, focusMember.id)
          return tally ? [{ ...tally, hourlyRate }] : []
        }),
      ),
      summary => ({ ...summary, name: focusMember.name }),
    )

  return (
    <section className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {focusMember
          ? `Everyone's time on ${focusMember.name}'s ${plural('client', clients.length)}`
          : `Everyone's time across ${plural('client', clients.length)}`}
      </p>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <TimeCard team={team} member={member ?? undefined} />

        {STATS.map(stat => (
          <Card key={stat.label} className="py-4">
            <CardContent className="flex h-full flex-col gap-1">
              <span className="text-sm text-muted-foreground">
                {stat.label}
              </span>
              <span className="text-2xl font-semibold tabular-nums">
                {stat.value(team)}
              </span>
              {stat.note && (
                <span className="mt-1 text-xs text-muted-foreground">
                  {stat.note}
                </span>
              )}
              {member && (
                <span className="mt-auto border-t pt-3 text-sm text-muted-foreground">
                  {member.name}:{' '}
                  <span className="font-medium text-foreground tabular-nums">
                    {stat.value(member)}
                  </span>
                </span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
