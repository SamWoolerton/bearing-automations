import { PencilIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { NumberInput } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { errorMessage } from '@/lib/errors'
import {
  formatHours,
  isQuarterHourMultiple,
  QUARTER_HOUR_SECONDS,
} from '@/lib/hours'
import type { Tally } from '@/lib/hours'
import { entriesLabel } from '@/writeOff/components/labels'
import { TallyDisplay } from '@/writeOff/components/TallyDisplay'
import type { ChangeLog } from '@/writeOff/execute'
import type { WriteOffRequest } from '@/writeOff/functions'
import { confirmWriteOff, prepareWriteOff } from '@/writeOff/functions'
import type { WriteOffPlan } from '@/writeOff/plan'

export type WriteOffExecuted = {
  request: WriteOffRequest
  log: ChangeLog
  totalSeconds: number
}

export type OnWriteOffExecuted = (executed: WriteOffExecuted) => void

type WriteOffCellProps = {
  month: string
  userId: string
  userName: string
  projectId: string
  projectName: string
  tally: Tally
  onExecuted: OnWriteOffExecuted
}

export function WriteOffCell({
  tally,
  onExecuted,
  ...props
}: WriteOffCellProps) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  return (
    <Popover
      open={open}
      onOpenChange={o => {
        if (!pending) setOpen(o)
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 tabular-nums transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground"
        >
          <PencilIcon className="size-3 opacity-0 transition-opacity group-hover:opacity-60 group-focus-visible:opacity-60 group-data-[state=open]:opacity-60" />
          <TallyDisplay tally={tally} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <WriteOffForm
          {...props}
          tally={tally}
          pending={pending}
          setPending={setPending}
          onExecuted={executed => {
            setOpen(false)
            onExecuted(executed)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

const toQuarterHoursBelow = (seconds: number) =>
  Math.floor(seconds / QUARTER_HOUR_SECONDS) * QUARTER_HOUR_SECONDS

function targetError(target: number | null, billableSeconds: number) {
  if (target === null) return 'Enter the billable hours to keep'
  if (target < 0) return "Can't be negative"
  if (!isQuarterHourMultiple(target)) return 'Use 15 minute steps'
  if (target >= billableSeconds)
    return `Must be less than the current ${formatHours(billableSeconds)}h billable`
  return null
}

type Prepared = { request: WriteOffRequest; plan: WriteOffPlan }

function WriteOffForm({
  month,
  userId,
  userName,
  projectId,
  projectName,
  tally: { billableSeconds, totalSeconds },
  pending,
  setPending,
  onExecuted,
}: WriteOffCellProps & {
  pending: boolean
  setPending: (pending: boolean) => void
}) {
  const [hours, setHours] = useState<number | null>(
    toQuarterHoursBelow(billableSeconds) / 3600,
  )
  const [prepared, setPrepared] = useState<Prepared | null>(null)
  const [error, setError] = useState<string | null>(null)

  const target = hours === null ? null : Math.round(hours * 3600)
  const validationError = targetError(target, billableSeconds)

  async function run(action: () => Promise<void>) {
    setPending(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setPrepared(null)
      setError(errorMessage(e))
    } finally {
      setPending(false)
    }
  }

  const prepare = (targetBillableSeconds: number) =>
    run(async () => {
      const request = { month, userId, projectId, targetBillableSeconds }
      setPrepared({ request, plan: await prepareWriteOff({ data: request }) })
    })

  const confirm = ({ request, plan }: Prepared) =>
    run(async () => {
      const log = await confirmWriteOff({
        data: { ...request, confirmedPlan: plan },
      })
      onExecuted({ request, log, totalSeconds })
    })

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={e => {
        e.preventDefault()
        if (pending || prepared || validationError || target === null) return
        void prepare(target)
      }}
    >
      <PopoverHeader>
        <PopoverTitle>{userName}</PopoverTitle>
        <PopoverDescription>{projectName}</PopoverDescription>
      </PopoverHeader>
      <label className="flex flex-col gap-1 text-sm">
        Billable hours to keep
        <NumberInput
          value={hours}
          step={0.25}
          min={0}
          readOnly={pending}
          aria-invalid={validationError !== null}
          onFocus={e => e.target.select()}
          onChange={v => {
            setHours(v)
            setPrepared(null)
            setError(null)
          }}
        />
      </label>
      {validationError && (
        <p className="text-sm text-muted-foreground">{validationError}</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {prepared ? (
        <>
          <PlanPreview
            plan={prepared.plan}
            reportedBillableSeconds={billableSeconds}
          />
          <Button
            type="button"
            disabled={pending}
            onClick={() => void confirm(prepared)}
          >
            {pending ? 'Writing off…' : 'Confirm write-off'}
          </Button>
        </>
      ) : (
        <Button
          type="submit"
          variant="outline"
          disabled={pending || validationError !== null}
        >
          {pending ? 'Preparing…' : 'Preview'}
        </Button>
      )}
    </form>
  )
}

function PlanPreview({
  plan,
  reportedBillableSeconds,
}: {
  plan: WriteOffPlan
  reportedBillableSeconds: number
}) {
  const split = plan.ops.find(op => op.kind === 'split')
  const markedCount = plan.ops.filter(
    op => op.kind === 'markNonBillable',
  ).length
  const remaining = plan.availableSeconds - plan.writeOffSeconds

  return (
    <div className="flex flex-col gap-1 rounded-md bg-muted p-3 text-sm">
      <p className="font-medium">
        {formatHours(plan.availableSeconds)}h → {formatHours(remaining)}h
        billable (write off {formatHours(plan.writeOffSeconds)}h)
      </p>
      {markedCount > 0 && (
        <p>{entriesLabel(markedCount)} marked non-billable</p>
      )}
      {split?.kind === 'split' && (
        <p>
          1 entry split: {formatHours(split.billableSeconds)}h stays billable,{' '}
          {formatHours(split.nonBillableSeconds)}h written off
        </p>
      )}
      {plan.availableSeconds !== reportedBillableSeconds && (
        <p className="text-amber-700 dark:text-amber-400">
          The overview shows {formatHours(reportedBillableSeconds)}h billable,
          but the live entries total {formatHours(plan.availableSeconds)}h — the
          report may be stale.
        </p>
      )}
    </div>
  )
}
