import { Loader2Icon, TriangleAlertIcon } from 'lucide-react'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export type CellSync =
  | { state: 'syncing' }
  | { state: 'stale' | 'failed'; message: string }

export type CellSyncs = ReadonlyMap<string, CellSync>

export const cellKey = (projectId: string, userId: string) =>
  `${projectId}:${userId}`

export const cellSyncClass = (sync: CellSync | undefined) =>
  sync && sync.state !== 'syncing' && 'bg-negative/10 text-negative'

export function CellSyncIndicator({ sync }: { sync: CellSync }) {
  if (sync.state === 'syncing')
    return (
      <Loader2Icon
        className="size-3.5 animate-spin text-muted-foreground"
        aria-label="Waiting for Clockify's report to update"
      />
    )
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} aria-label={sync.message}>
          <TriangleAlertIcon className="size-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{sync.message}</TooltipContent>
    </Tooltip>
  )
}
