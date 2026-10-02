import { sumBy } from '@bearing-agency/utilities/arrays'
import { cn } from '@bearing-agency/utilities/classnames'

import { Fragment } from 'react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Tally } from '@/lib/hours'
import { tallyLabel } from '@/lib/hours'
import { WriteOffCell } from '@/writeOff/components/WriteOffCell'
import type { ChangeLog } from '@/writeOff/execute'
import type { WriteOffRequest } from '@/writeOff/functions'
import type { Overview } from '@/writeOff/overview'
import { membersIn } from '@/writeOff/overview'

const Empty = () => <span className="text-muted-foreground">—</span>

const TallyText = ({ tally }: { tally: Tally }) => (
  <span className="px-1 tabular-nums">{tallyLabel(tally)}</span>
)

function sumTallies(tallies: Tally[]) {
  if (tallies.length === 0) return null
  return {
    billableSeconds: sumBy(tallies, t => t.billableSeconds),
    totalSeconds: sumBy(tallies, t => t.totalSeconds),
  }
}

export function OverviewTable({
  clients,
  focusMemberId,
  onExecuted,
}: {
  clients: Overview
  focusMemberId: string | undefined
  onExecuted: (request: WriteOffRequest, log: ChangeLog) => void
}) {
  const members = membersIn(clients)
  const memberCellClass = (memberId: string) =>
    cn('text-right', memberId === focusMemberId && 'bg-primary/5')
  const totalCellClass = 'border-l text-right'

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Client / project</TableHead>
          {members.map(m => (
            <TableHead key={m.id} className={memberCellClass(m.id)}>
              {m.name}
            </TableHead>
          ))}
          <TableHead className={totalCellClass}>Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map(client => (
          <Fragment key={client.id}>
            <TableRow className="border-t-2 bg-muted/60 font-semibold hover:bg-muted/60">
              <TableCell className="text-base">{client.name}</TableCell>
              {members.map(m => {
                const tally = sumTallies(
                  client.projects.flatMap(p =>
                    p.users.filter(u => u.id === m.id),
                  ),
                )
                return (
                  <TableCell key={m.id} className={memberCellClass(m.id)}>
                    {tally ? <TallyText tally={tally} /> : <Empty />}
                  </TableCell>
                )
              })}
              <TableCell className={cn(totalCellClass, 'text-base')}>
                <TallyText tally={client} />
              </TableCell>
            </TableRow>
            {client.projects.map(project => (
              <TableRow key={project.id}>
                <TableCell className="pl-6">{project.name}</TableCell>
                {members.map(m => {
                  const user = project.users.find(u => u.id === m.id)
                  return (
                    <TableCell key={m.id} className={memberCellClass(m.id)}>
                      {!user ? (
                        <Empty />
                      ) : user.billableSeconds === 0 ? (
                        <TallyText tally={user} />
                      ) : (
                        <WriteOffCell
                          userId={m.id}
                          userName={m.name}
                          projectId={project.id}
                          projectName={`${client.name} / ${project.name}`}
                          tally={user}
                          onExecuted={onExecuted}
                        />
                      )}
                    </TableCell>
                  )
                })}
                <TableCell className={cn(totalCellClass, 'font-medium')}>
                  <TallyText tally={project} />
                </TableCell>
              </TableRow>
            ))}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  )
}
