import {
  partition,
  sumBy,
  unique,
  uniqueBy,
} from '@bearing-agency/utilities/arrays'
import { assert } from '@bearing-agency/utilities/assertions'
import { buildMapBy } from '@bearing-agency/utilities/maps'
import { compareStringAsc } from '@bearing-agency/utilities/sort'

import type { ClockifyClientProjectUserTime } from '@/clients/clockify'
import type { Tally } from '@/lib/hours'
import { sumTallies } from '@/lib/hours'

type Group = { _id: string; name: string; duration: number }

const byName = (a: { name: string }, b: { name: string }) =>
  compareStringAsc(a.name, b.name)

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
    .toSorted(byName)
}

const mergeOverview = (
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

export type Overview = ReturnType<typeof mergeOverview>

const NO_CLIENT = ''
const INTERNAL_PROJECT = 'Internal'
const BEARING_CLIENT = 'Bearing'

const shiftTally = <T extends Tally>(tally: T, by: Tally, sign: 1 | -1) => ({
  ...tally,
  billableSeconds: tally.billableSeconds + sign * by.billableSeconds,
  totalSeconds: tally.totalSeconds + sign * by.totalSeconds,
})

function reclassifyInternalTime(overview: Overview) {
  const noClient = overview.find(c => c.name === NO_CLIENT)
  const [internal, others] = partition(
    noClient?.projects ?? [],
    p => p.name === INTERNAL_PROJECT,
  )
  if (!noClient || internal.length === 0) return overview

  const moved = {
    billableSeconds: sumBy(internal, p => p.billableSeconds),
    totalSeconds: sumBy(internal, p => p.totalSeconds),
  }
  const bearing = overview.find(c => c.name === BEARING_CLIENT) ?? {
    id: BEARING_CLIENT,
    name: BEARING_CLIENT,
    billableSeconds: 0,
    totalSeconds: 0,
    projects: [],
  }
  return [
    ...overview.filter(c => c !== noClient && c !== bearing),
    {
      ...shiftTally(bearing, moved, 1),
      projects: [...bearing.projects, ...internal].toSorted(byName),
    },
    ...(others.length > 0
      ? [{ ...shiftTally(noClient, moved, -1), projects: others }]
      : []),
  ].toSorted(byName)
}

export const buildOverview = (
  all: ClockifyClientProjectUserTime[],
  billable: ClockifyClientProjectUserTime[],
) => reclassifyInternalTime(mergeOverview(all, billable))

export const clientsWorkedOnBy = <C extends Overview[number]>(
  overview: C[],
  userId: string,
) =>
  overview.filter(c => c.projects.some(p => p.users.some(u => u.id === userId)))

export const memberTally = (
  projects: Overview[number]['projects'],
  userId: string,
) => sumTallies(projects.flatMap(p => p.users.filter(u => u.id === userId)))

export const membersIn = (overview: Overview) =>
  uniqueBy(
    overview.flatMap(c => c.projects.flatMap(p => p.users)),
    u => u.id,
  )
    .map(({ id, name }) => ({ id, name }))
    .toSorted(byName)
