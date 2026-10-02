import { createFileRoute, useRouter } from '@tanstack/react-router'
import { RefreshCwIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import z from 'zod'

import { PageShell } from '@/components/PageShell'
import { Button } from '@/components/ui/button'
import { SelectInput } from '@/components/ui/select'
import { wait } from '@/lib/async'
import { errorMessage } from '@/lib/errors'
import type { Tally } from '@/lib/hours'
import { formatDuration, formatHours } from '@/lib/hours'
import type { CellSync, CellSyncs } from '@/writeOff/components/CellSync'
import { cellKey } from '@/writeOff/components/CellSync'
import { ChangeLogSheet } from '@/writeOff/components/ChangeLogSheet'
import { OverviewTable } from '@/writeOff/components/OverviewTable'
import {
  PAGE_TITLE,
  WriteOffPageError,
  WriteOffPageSkeleton,
} from '@/writeOff/components/PageStates'
import { SummaryStrip } from '@/writeOff/components/SummaryStrip'
import type { WriteOffExecuted } from '@/writeOff/components/WriteOffCell'
import { getMonthOverview, getWriteOffLogs } from '@/writeOff/functions'

const loadOverview = (member: string | undefined, month?: string) =>
  getMonthOverview({ data: { userId: member, month } })

export const Route = createFileRoute('/')({
  validateSearch: z.object({ member: z.string().optional() }),
  loaderDeps: ({ search }) => ({ member: search.member }),
  loader: async ({ deps }) => {
    const [overview, logs] = await Promise.all([
      loadOverview(deps.member),
      getWriteOffLogs(),
    ])
    return { overview, logs }
  },
  component: WriteOffPage,
  pendingComponent: WriteOffPageSkeleton,
  pendingMs: 200,
  errorComponent: WriteOffPageError,
})

const ALL_CLIENTS = 'all'
const REPORT_POLL_ATTEMPTS = 10
const REPORT_POLL_INTERVAL_MS = 2000

async function verifyReport(
  member: string | undefined,
  { request, totalSeconds }: WriteOffExecuted,
): Promise<CellSync | null> {
  const { month, userId, projectId, targetBillableSeconds } = request
  let reported: Tally | undefined
  for (let attempt = 0; attempt < REPORT_POLL_ATTEMPTS; attempt++) {
    await wait(REPORT_POLL_INTERVAL_MS)
    const { clients } = await loadOverview(member, month)
    reported = clients
      .flatMap(c => c.projects)
      .find(p => p.id === projectId)
      ?.users.find(u => u.id === userId)
    if (reported?.billableSeconds !== targetBillableSeconds) continue
    if (reported.totalSeconds === totalSeconds) return null
    return {
      state: 'failed',
      message: `Total changed from ${formatDuration(totalSeconds)} to ${formatDuration(reported.totalSeconds)} — check Clockify`,
    }
  }
  return {
    state: 'stale',
    message: `Expected ${formatDuration(targetBillableSeconds)} billable, report still shows ${reported ? formatDuration(reported.billableSeconds) : 'no time'} — refresh to check again`,
  }
}

function WriteOffPage() {
  const { overview, logs } = Route.useLoaderData()
  const { member } = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)
  const [syncs, setSyncs] = useState<CellSyncs>(new Map())

  const setSync = (key: string, sync: CellSync | null) =>
    setSyncs(prev => {
      const next = new Map(prev)
      if (sync) next.set(key, sync)
      else next.delete(key)
      return next
    })

  async function refresh() {
    setRefreshing(true)
    setSyncs(prev => new Map([...prev].filter(([, s]) => s.state !== 'stale')))
    try {
      await router.invalidate()
    } catch (e) {
      toast.error('Refresh failed', { description: errorMessage(e) })
    } finally {
      setRefreshing(false)
    }
  }

  async function syncCell(key: string, executed: WriteOffExecuted) {
    setSync(key, { state: 'syncing' })
    try {
      const problem = await verifyReport(member, executed)
      await router.invalidate()
      setSync(key, problem)
    } catch (e) {
      setSync(key, {
        state: 'stale',
        message: `Couldn't refresh: ${errorMessage(e)}`,
      })
    }
  }

  function handleExecuted(executed: WriteOffExecuted) {
    const { request, log } = executed
    const key = cellKey(request.projectId, request.userId)
    if (log.error) {
      const title = 'Write-off stopped partway'
      const description = `${log.error} — see the change log for what was applied`
      setSync(key, { state: 'failed', message: `${title}: ${description}` })
      toast.error(title, { description, duration: Infinity })
      void refresh()
      return
    }
    toast.success(
      `Wrote off ${formatHours(log.plan.writeOffSeconds)}h, ${formatHours(request.targetBillableSeconds)}h stays billable`,
    )
    void syncCell(key, executed)
  }

  return (
    <PageShell
      title={`${PAGE_TITLE} · ${overview.period.label}`}
      actions={
        <>
          <SelectInput
            className="w-56"
            value={member ?? ALL_CLIENTS}
            options={[
              { label: 'All clients', value: ALL_CLIENTS },
              ...overview.members.map(m => ({
                label: `${m.name}'s clients`,
                value: m.id,
              })),
            ]}
            onChange={v =>
              void navigate({
                search: { member: v === ALL_CLIENTS ? undefined : v },
              })
            }
          />
          <Button
            variant="outline"
            disabled={refreshing}
            onClick={() => void refresh()}
          >
            <RefreshCwIcon
              className={refreshing ? 'animate-spin' : undefined}
            />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
          <ChangeLogSheet logs={logs} />
        </>
      }
    >
      {overview.clients.length === 0 ? (
        <p className="text-muted-foreground">No time logged this period.</p>
      ) : (
        <>
          <SummaryStrip
            clients={overview.clients}
            focusMember={overview.members.find(m => m.id === member)}
          />
          <OverviewTable
            month={overview.period.key}
            clients={overview.clients}
            focusMemberId={member}
            syncs={syncs}
            onExecuted={handleExecuted}
          />
        </>
      )}
    </PageShell>
  )
}
