import { sumBy } from '@bearing-agency/utilities/arrays'
import { compareStringAsc } from '@bearing-agency/utilities/sort'

import type { ClockifyReportTimeEntry } from '@/clients/clockify'

const tally = (entries: ClockifyReportTimeEntry[]) => ({
  totalSeconds: sumBy(entries, e => e.timeInterval.duration),
  billableSeconds: sumBy(
    entries.filter(e => e.billable),
    e => e.timeInterval.duration,
  ),
})

function groupAndTally<K, R extends { name: string }>(
  entries: ClockifyReportTimeEntry[],
  getKey: (entry: ClockifyReportTimeEntry) => K,
  describe: (key: K, group: ClockifyReportTimeEntry[]) => R,
) {
  return [...Map.groupBy(entries, getKey)]
    .map(([key, group]) => ({ ...describe(key, group), ...tally(group) }))
    .toSorted((a, b) => compareStringAsc(a.name, b.name))
}

export function buildOverview(entries: ClockifyReportTimeEntry[]) {
  return groupAndTally(
    entries,
    e => e.clientId ?? null,
    (clientId, clientEntries) => ({
      clientId,
      name: clientEntries[0].clientName ?? '(No client)',
      projects: groupAndTally(
        clientEntries,
        e => e.projectId ?? null,
        (projectId, projectEntries) => ({
          projectId,
          name: projectEntries[0].projectName ?? '(No project)',
          users: groupAndTally(
            projectEntries,
            e => e.userId,
            (userId, userEntries) => ({
              userId,
              name: userEntries[0].userName,
            }),
          ),
        }),
      ),
    }),
  )
}

export type Overview = ReturnType<typeof buildOverview>

export const clientsWorkedOnBy = (overview: Overview, userId: string) =>
  overview.filter(c =>
    c.projects.some(p => p.users.some(u => u.userId === userId)),
  )
