import { mapNullish } from '@bearing-agency/utilities/nullish'
import { plural } from '@bearing-agency/utilities/strings'

import type { ReactNode } from 'react'

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

const VALUE_CLASS = 'text-2xl font-semibold tabular-nums'

const formatRate = (rate: number | null) =>
  rate === null ? '—' : `${formatDollars(rate)}/h`

const formatRates = (summary: EarningsSummary) =>
  `${formatRate(summary.averageHourlyRate)} · ${formatRate(summary.effectiveHourlyRate)}`

function StatCard({
  label,
  member,
  children,
}: {
  label: string
  member: { name: string; value: string } | undefined
  children: ReactNode
}) {
  return (
    <Card className="py-4">
      <CardContent className="flex h-full flex-col gap-1">
        <span className="text-sm text-muted-foreground">{label}</span>
        {children}
        {member && (
          <span className="mt-auto border-t pt-3 text-sm text-muted-foreground">
            {member.name}:{' '}
            <span className="font-medium text-foreground tabular-nums">
              {member.value}
            </span>
          </span>
        )}
      </CardContent>
    </Card>
  )
}

function RateLine({ rate, caption }: { rate: number | null; caption: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className={VALUE_CLASS}>{formatRate(rate)}</span>
      <span className="text-sm text-muted-foreground">{caption}</span>
    </div>
  )
}

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
    (focusMember &&
      mapNullish(
        summariseEarnings(
          clients.flatMap(({ projects, hourlyRate }) => {
            const tally = memberTally(projects, focusMember.id)
            return tally ? [{ ...tally, hourlyRate }] : []
          }),
        ),
        summary => ({ ...summary, name: focusMember.name }),
      )) ??
    undefined

  return (
    <section className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {focusMember
          ? `Everyone's time on ${focusMember.name}'s ${plural('client', clients.length)}`
          : `Everyone's time across ${plural('client', clients.length)}`}
      </p>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <TimeCard team={team} member={member} />

        <StatCard
          label="Billable $"
          member={
            member && {
              name: member.name,
              value: formatDollars(member.billableAmount),
            }
          }
        >
          <span className={VALUE_CLASS}>
            {formatDollars(team.billableAmount)}
          </span>
          <span className="mt-1 text-xs text-muted-foreground">{NZD_NOTE}</span>
        </StatCard>

        <StatCard
          label="Hourly rate"
          member={member && { name: member.name, value: formatRates(member) }}
        >
          <div className="flex flex-col gap-1">
            <RateLine
              rate={team.averageHourlyRate}
              caption="per billable hour"
            />
            <RateLine
              rate={team.effectiveHourlyRate}
              caption="per hour worked"
            />
          </div>
        </StatCard>
      </div>
    </section>
  )
}
