import { range } from '@bearing-agency/utilities/arrays'

import { useRouter } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { RefreshCwIcon, TriangleAlertIcon } from 'lucide-react'

import { PageShell } from '@/components/PageShell'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage } from '@/lib/errors'

export const PAGE_TITLE = 'Billable hours breakdown'

const SKELETON_TILES = 4
const SKELETON_ROWS = 8

export function WriteOffPageSkeleton() {
  return (
    <PageShell
      title={PAGE_TITLE}
      actions={
        <>
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-28" />
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-48" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {range(0, SKELETON_TILES - 1).map(i => (
            <Card key={i} className="gap-1 py-4">
              <CardContent className="flex flex-col gap-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-7 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <Card className="py-4">
        <CardContent className="flex flex-col gap-3">
          {range(0, SKELETON_ROWS - 1).map(i => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </CardContent>
      </Card>
    </PageShell>
  )
}

export function WriteOffPageError({ error }: ErrorComponentProps) {
  const router = useRouter()

  return (
    <PageShell title={PAGE_TITLE}>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TriangleAlertIcon className="size-5 text-negative" />
            Couldn't load time from Clockify
          </CardTitle>
          <CardDescription>
            Nothing has been changed. Try again, and if it keeps failing check
            the Clockify API key and workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <code className="block text-sm wrap-break-word whitespace-pre-wrap">
            {errorMessage(error)}
          </code>
        </CardContent>
        <CardFooter>
          <Button onClick={() => void router.invalidate()}>
            <RefreshCwIcon />
            Try again
          </Button>
        </CardFooter>
      </Card>
    </PageShell>
  )
}
