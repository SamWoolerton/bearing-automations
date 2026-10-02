import { plural } from '@bearing-agency/utilities/strings'

import { format } from 'date-fns'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { formatHours } from '@/lib/hours'
import { entriesLabel } from '@/writeOff/components/labels'
import type { ChangeLog } from '@/writeOff/execute'

const formatTimestamp = (iso: string) => format(iso, 'd MMM yyyy, h:mm a')

export function ChangeLogSheet({ logs }: { logs: ChangeLog[] }) {
  const errorCount = logs.filter(l => l.error).length

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">
          Change log
          {errorCount > 0 && (
            <Badge variant="destructive">{plural('error', errorCount)}</Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Change log</SheetTitle>
          <SheetDescription>
            Every write-off run, newest first.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4 pb-4">
          {logs.length === 0 && (
            <p className="text-sm text-muted-foreground">No write-offs yet.</p>
          )}
          {logs.map(log => (
            <LogCard key={log.id} log={log} />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function LogCard({ log }: { log: ChangeLog }) {
  const { plan } = log
  const entry = plan.ops[0]?.entry

  return (
    <details className="rounded-md border p-3 text-sm">
      <summary className="flex cursor-pointer flex-col gap-1">
        <span className="flex items-center gap-2 font-medium">
          {formatTimestamp(log.createdAt)}
          {log.error && <Badge variant="destructive">Error</Badge>}
        </span>
        {entry && (
          <span>
            {entry.userName} · {entry.clientName} / {entry.projectName}
          </span>
        )}
        <span className="text-muted-foreground">
          Wrote off {formatHours(plan.writeOffSeconds)}h (
          {formatHours(plan.availableSeconds)}h →{' '}
          {formatHours(plan.availableSeconds - plan.writeOffSeconds)}h billable)
          · {log.items.length} of {entriesLabel(plan.ops.length)} changed
        </span>
        {log.error && <span className="text-destructive">{log.error}</span>}
      </summary>
      <ul className="mt-3 flex flex-col gap-2 border-t pt-3">
        {log.items.map(item => (
          <li key={item.entryId} className="flex flex-col">
            <span>
              {item.kind === 'split' ? 'Split' : 'Marked non-billable'} ·{' '}
              <code>{item.entryId}</code>
            </span>
            <span className="text-muted-foreground">
              Originally {formatTimestamp(item.original.start)} –{' '}
              {format(item.original.end, 'h:mm a')}
              {item.createdEntryId && (
                <>
                  {' '}
                  · created <code>{item.createdEntryId}</code>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}
