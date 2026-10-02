import { unique } from '@bearing-agency/utilities/arrays'
import { assert } from '@bearing-agency/utilities/assertions'
import { buildMapBy } from '@bearing-agency/utilities/maps'
import { compareStringAsc } from '@bearing-agency/utilities/sort'

import type { ClockifyClientProjectUserTime } from '@/clients/clockify'

type Group = { _id: string; name: string; duration: number }

function assertUniqueIds(groups: Group[]) {
  const ids = groups.map(g => g._id)
  assert(
    unique(ids).length === ids.length,
    `Duplicate Clockify summary group ids: ${ids.join(', ')}`,
  )
}

function mergeBillable<G extends Group, R>(
  all: G[],
  billable: G[],
  describe: (group: G, billableGroup: G | undefined) => R,
) {
  assertUniqueIds(all)
  assertUniqueIds(billable)
  const allById = buildMapBy(all, g => g._id)
  for (const b of billable)
    assert(
      allById.has(b._id),
      `Billable group "${b.name}" (${b._id}) missing from total time`,
    )

  const billableById = buildMapBy(billable, g => g._id)
  return all
    .map(group => {
      const billableGroup = billableById.get(group._id)
      const billableSeconds = billableGroup?.duration ?? 0
      assert(
        billableSeconds <= group.duration,
        `"${group.name}" has more billable (${billableSeconds}s) than total (${group.duration}s) time`,
      )
      return {
        id: group._id,
        name: group.name,
        totalSeconds: group.duration,
        billableSeconds,
        ...describe(group, billableGroup),
      }
    })
    .toSorted((a, b) => compareStringAsc(a.name, b.name))
}

export const buildOverview = (
  all: ClockifyClientProjectUserTime[],
  billable: ClockifyClientProjectUserTime[],
) =>
  mergeBillable(all, billable, (client, billableClient) => ({
    projects: mergeBillable(
      client.children,
      billableClient?.children ?? [],
      (project, billableProject) => ({
        users: mergeBillable(
          project.children,
          billableProject?.children ?? [],
          () => ({}),
        ),
      }),
    ),
  }))

export type Overview = ReturnType<typeof buildOverview>

export const clientsWorkedOnBy = (overview: Overview, userId: string) =>
  overview.filter(c => c.projects.some(p => p.users.some(u => u.id === userId)))
