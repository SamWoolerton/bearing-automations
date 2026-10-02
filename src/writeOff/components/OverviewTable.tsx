import { cn } from '@bearing-agency/utilities/classnames'
import { setToggle } from '@bearing-agency/utilities/sets'

import { ChevronRightIcon } from 'lucide-react'
import { Fragment, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Tally } from '@/lib/hours'
import type { CellSyncs } from '@/writeOff/components/CellSync'
import {
  cellKey,
  cellSyncClass,
  CellSyncIndicator,
} from '@/writeOff/components/CellSync'
import { TallyDisplay } from '@/writeOff/components/TallyDisplay'
import { WriteOffCell } from '@/writeOff/components/WriteOffCell'
import type { OnWriteOffExecuted } from '@/writeOff/components/WriteOffCell'
import type { Overview } from '@/writeOff/overview'
import { membersIn, memberTally } from '@/writeOff/overview'

const Empty = () => <span className="text-muted-foreground">—</span>

const TallyText = ({
  tally,
  className,
}: {
  tally: Tally
  className?: string
}) => (
  <span className={cn('inline-flex px-1.5', className)}>
    <TallyDisplay tally={tally} />
  </span>
)

const stickyColumnClass =
  'sticky left-0 z-10 shadow-[1px_0_0_var(--color-border)]'

export function OverviewTable({
  month,
  clients,
  focusMemberId,
  syncs,
  onExecuted,
}: {
  month: string
  clients: Overview
  focusMemberId: string | undefined
  syncs: CellSyncs
  onExecuted: OnWriteOffExecuted
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const allCollapsed = clients.every(c => collapsed.has(c.id))
  const members = membersIn(clients)
  const memberCellClass = (memberId: string) =>
    cn('text-right', memberId === focusMemberId && 'bg-primary/5')
  const totalCellClass = 'border-r text-right'

  return (
    <Card className="py-4">
      <CardContent>
        <Table containerClassName="max-h-[75vh]">
          <TableHeader className="sticky top-0 z-20 bg-card shadow-[0_1px_0_var(--color-border)]">
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn(stickyColumnClass, 'bg-card')}>
                Client / project
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-2 h-6 px-2 text-xs text-muted-foreground"
                  onClick={() =>
                    setCollapsed(
                      allCollapsed
                        ? new Set()
                        : new Set(clients.map(c => c.id)),
                    )
                  }
                >
                  {allCollapsed ? 'Expand all' : 'Collapse all'}
                </Button>
              </TableHead>
              <TableHead className={totalCellClass}>Total</TableHead>
              {members.map(m => (
                <TableHead key={m.id} className={memberCellClass(m.id)}>
                  {m.name}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map(client => (
              <Fragment key={client.id}>
                <TableRow className="border-t-2 bg-surface-page font-semibold hover:bg-surface-page has-aria-expanded:bg-surface-page">
                  <TableCell
                    className={cn(
                      stickyColumnClass,
                      'bg-surface-page text-base',
                    )}
                  >
                    <button
                      type="button"
                      aria-expanded={!collapsed.has(client.id)}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      onClick={() => setCollapsed(c => setToggle(c, client.id))}
                    >
                      <ChevronRightIcon
                        className={cn(
                          'size-4 text-muted-foreground transition-transform',
                          !collapsed.has(client.id) && 'rotate-90',
                        )}
                      />
                      {client.name}
                    </button>
                  </TableCell>
                  <TableCell className={cn(totalCellClass, 'text-base')}>
                    <TallyText tally={client} />
                  </TableCell>
                  {members.map(m => {
                    const tally = memberTally(client.projects, m.id)
                    return (
                      <TableCell key={m.id} className={memberCellClass(m.id)}>
                        {tally ? <TallyText tally={tally} /> : <Empty />}
                      </TableCell>
                    )
                  })}
                </TableRow>
                {!collapsed.has(client.id) &&
                  client.projects.map(project => (
                    <TableRow key={project.id}>
                      <TableCell
                        className={cn(stickyColumnClass, 'bg-card pl-6')}
                      >
                        {project.name}
                      </TableCell>
                      <TableCell className={cn(totalCellClass, 'font-medium')}>
                        <TallyText tally={project} />
                      </TableCell>
                      {members.map(m => {
                        const user = project.users.find(u => u.id === m.id)
                        const sync = syncs.get(cellKey(month, project.id, m.id))
                        return (
                          <TableCell
                            key={m.id}
                            className={cn(
                              memberCellClass(m.id),
                              cellSyncClass(sync),
                            )}
                          >
                            <span className="inline-flex items-center gap-1">
                              {sync && <CellSyncIndicator sync={sync} />}
                              {!user ? (
                                <Empty />
                              ) : user.billableSeconds === 0 ? (
                                <TallyText
                                  tally={user}
                                  className={cn(
                                    !sync && 'text-muted-foreground',
                                  )}
                                />
                              ) : (
                                <WriteOffCell
                                  month={month}
                                  userId={m.id}
                                  userName={m.name}
                                  projectId={project.id}
                                  projectName={`${client.name} / ${project.name}`}
                                  tally={user}
                                  onExecuted={onExecuted}
                                />
                              )}
                            </span>
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
