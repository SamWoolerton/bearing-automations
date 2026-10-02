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

  async function refresh(expected?: WriteOffRequest) {
    setRefreshing(true)
    try {
      const caughtUp = expected
        ? await waitForReportToShow(member, expected)
        : true
      await router.invalidate()
      if (!caughtUp)
        toast.warning(
          "Clockify's report hasn't caught up yet — refresh again in a moment",
        )
    } catch (e) {
      toast.error('Refresh failed', { description: errorMessage(e) })
    } finally {
      setRefreshing(false)
    }
  }

  function handleExecuted(request: WriteOffRequest, log: ChangeLog) {
    if (log.error) {
      toast.error('Write-off stopped partway', {
        description: `${log.error} — see the change log for what was applied.`,
        duration: Infinity,
      })
      void refresh()
      return
    }
    toast.success(
      `Wrote off ${formatHours(log.plan.writeOffSeconds)}h, ${formatHours(request.targetBillableSeconds)}h stays billable`,
    )
    void refresh(request)
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
          onExecuted={handleExecuted}
        />
      )}
    </div>
  )
}
