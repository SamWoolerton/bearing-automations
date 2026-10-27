import { mapNullish } from '@bearing-agency/utilities/nullish'
import { plural } from '@bearing-agency/utilities/strings'

import type { ReactNode } from 'react'

import type { Currency } from '@/billing/clientConfig'
import { NZD_PER_UNIT } from '@/billing/clientConfig'
import type { EarningsSummary, Rated } from '@/billing/earnings'
import { summariseEarnings } from '@/billing/earnings'
import type { TargetLineup } from '@/billing/targets'
import { LegendItem, SegmentedBar } from '@/components/SplitBar'
import { Card, CardContent } from '@/components/ui/card'
import { formatDollars, formatMoney } from '@/lib/currency'
import { formatPercent } from '@/lib/percent'
import { TargetCard } from '@/writeOff/components/TargetCard'
import { TimeCard } from '@/writeOff/components/TimeCard'
import type { Overview } from '@/writeOff/overview'
import { memberTallies, memberTally } from '@/writeOff/overview'

const CURRENCY_COLOURS: Record<Currency, string> = {
  NZD: 'bg-primary',
  USD: 'bg-primary/70',
  AUD: 'bg-primary/45',
  CAD: 'bg-primary/25',
}

const countryOf = (currency: Currency) => currency.slice(0, 2)

const formatConversion = ({
  currency,
  nativeAmount,
}: EarningsSummary['billableByCurrency'][number]) =>
  currency === 'NZD'
    ? undefined
    : `from ${formatMoney(nativeAmount, currency)} at ${NZD_PER_UNIT[currency]}`

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
  targets,
}: {
  clients: (Overview[number] & Rated)[]
  focusMember: { id: string; name: string } | undefined
  targets: TargetLineup
}) {
  const team = summariseEarnings(clients)
  if (!team) return null
  const member =
    (focusMember &&
      mapNullish(
        summariseEarnings(
          clients.flatMap(({ projects, hourlyRate, currency }) => {
            const tally = memberTally(projects, focusMember.id)
            return tally ? [{ ...tally, hourlyRate, currency }] : []
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
        <TimeCard
          team={team}
          people={memberTallies(clients)}
          focusMemberId={focusMember?.id}
        />

        <StatCard
          label="Billable $"
          member={
            member && {
              name: member.name,
              value: `${formatDollars(member.billableAmount)} · ${formatRates(member)}`,
            }
          }
        >
          <span className={VALUE_CLASS}>
            {formatDollars(team.billableAmount)}
          </span>
          <SegmentedBar
            className="mt-2"
            segments={team.billableByCurrency.map(split => ({
              key: split.currency,
              colour: CURRENCY_COLOURS[split.currency],
              value: split.amount,
              tooltip: `${countryOf(split.currency)} ·${formatDollars(split.amount)} · ${formatPercent((100 * split.amount) / team.billableAmount)}`,
            }))}
          />
          <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            {team.billableByCurrency.map(split => (
              <LegendItem
                key={split.currency}
                colour={CURRENCY_COLOURS[split.currency]}
                label={countryOf(split.currency)}
                value={formatDollars(split.amount)}
                detail={formatConversion(split)}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-1 border-t pt-3">
            <span className="text-sm text-muted-foreground">Hourly rate</span>
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

        <TargetCard lineup={targets} />
      </div>
    </section>
  )
}
