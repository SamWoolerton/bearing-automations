import { createFileRoute, useRouter } from '@tanstack/react-router'
import { RefreshCwIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import z from 'zod'

import { Button } from '@/components/ui/button'
import { SelectInput } from '@/components/ui/select'
import { wait } from '@/lib/async'
import { errorMessage } from '@/lib/errors'
import { formatHours } from '@/lib/hours'
import type { CellSync, CellSyncs } from '@/writeOff/components/CellSync'
import { cellKey } from '@/writeOff/components/CellSync'
import { ChangeLogSheet } from '@/writeOff/components/ChangeLogSheet'
import { OverviewTable } from '@/writeOff/components/OverviewTable'
import type { ChangeLog } from '@/writeOff/execute'
import type { WriteOffRequest } from '@/writeOff/functions'
import { getPriorMonthOverview, getWriteOffLogs } from '@/writeOff/functions'

const loadOverview = (member: string | undefined) =>
  getPriorMonthOverview({ data: { userId: member } })

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
})

const ALL_CLIENTS = 'all'
const REPORT_POLL_ATTEMPTS = 10
const REPORT_POLL_INTERVAL_MS = 2000

async function waitForReportToShow(
  member: string | undefined,
  { userId, projectId, targetBillableSeconds }: WriteOffRequest,
) {
  for (let attempt = 0; attempt < REPORT_POLL_ATTEMPTS; attempt++) {
    await wait(REPORT_POLL_INTERVAL_MS)
    const { clients } = await loadOverview(member)
    const user = clients
      .flatMap(c => c.projects)
      .find(p => p.id === projectId)
      ?.users.find(u => u.id === userId)
    if (user?.billableSeconds === targetBillableSeconds) return true
  }
  return false
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

  async function syncCell(key: string, request: WriteOffRequest) {
    setSync(key, { state: 'syncing' })
    try {
      const caughtUp = await waitForReportToShow(member, request)
      await router.invalidate()
      setSync(
        key,
        caughtUp
          ? null
          : {
              state: 'stale',
              message:
                "Clockify's report hasn't caught up yet — refresh to check again",
            },
      )
    } catch (e) {
      setSync(key, {
        state: 'stale',
        message: `Couldn't refresh: ${errorMessage(e)}`,
      })
    }
  }

  function handleExecuted(request: WriteOffRequest, log: ChangeLog) {
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
    void syncCell(key, request)
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-bold">
          Write-offs · {overview.period.label}
        </h1>
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
          <RefreshCwIcon className={refreshing ? 'animate-spin' : undefined} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
        <ChangeLogSheet logs={logs} />
      </header>
      {overview.clients.length === 0 ? (
        <p className="text-muted-foreground">No time logged this period.</p>
      ) : (
        <OverviewTable
          clients={overview.clients}
          focusMemberId={member}
          syncs={syncs}
          onExecuted={handleExecuted}
        />
      )}
    </div>
  )
}
