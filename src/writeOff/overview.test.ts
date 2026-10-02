import { sumBy } from '@bearing-agency/utilities/arrays'

import { describe, expect, it } from 'vitest'

import type { ClockifyClientProjectUserTime } from '@/clients/clockify'
import { HOUR_SECONDS, MINUTE_SECONDS } from '@/lib/hours'
import { buildOverview } from '@/writeOff/overview'

type Project = ClockifyClientProjectUserTime['children'][number]
type User = Project['children'][number]

const user = (id: string, duration: number): User => ({
  _id: id,
  name: `User ${id}`,
  duration,
})

const project = (id: string, name: string, users: User[]): Project => ({
  _id: id,
  name,
  duration: sumBy(users, u => u.duration),
  children: users,
})

const client = (
  id: string,
  name: string,
  projects: Project[],
): ClockifyClientProjectUserTime => ({
  _id: id,
  name,
  duration: sumBy(projects, p => p.duration),
  children: projects,
})

describe('buildOverview', () => {
  it('merges billable into total time at every level, sorted by name', () => {
    const all = [
      client('c2', 'Zeta', [
        project('p3', 'Zeta App', [user('u1', HOUR_SECONDS)]),
      ]),
      client('c1', 'Acme', [
        project('p2', 'Website', [
          user('u2', HOUR_SECONDS / 2),
          user('u1', HOUR_SECONDS),
        ]),
        project('p1', 'App', [user('u1', 2 * HOUR_SECONDS)]),
      ]),
    ]
    const billable = [
      client('c1', 'Acme', [
        project('p2', 'Website', [user('u1', HOUR_SECONDS)]),
        project('p1', 'App', [user('u1', 1.5 * HOUR_SECONDS)]),
      ]),
    ]
    expect(buildOverview(all, billable)).toMatchInlineSnapshot(`
      [
        {
          "billableSeconds": 9000,
          "id": "c1",
          "name": "Acme",
          "projects": [
            {
              "billableSeconds": 5400,
              "id": "p1",
              "name": "App",
              "totalSeconds": 7200,
              "users": [
                {
                  "billableSeconds": 5400,
                  "id": "u1",
                  "name": "User u1",
                  "totalSeconds": 7200,
                },
              ],
            },
            {
              "billableSeconds": 3600,
              "id": "p2",
              "name": "Website",
              "totalSeconds": 5400,
              "users": [
                {
                  "billableSeconds": 3600,
                  "id": "u1",
                  "name": "User u1",
                  "totalSeconds": 3600,
                },
                {
                  "billableSeconds": 0,
                  "id": "u2",
                  "name": "User u2",
                  "totalSeconds": 1800,
                },
              ],
            },
          ],
          "totalSeconds": 12600,
        },
        {
          "billableSeconds": 0,
          "id": "c2",
          "name": "Zeta",
          "projects": [
            {
              "billableSeconds": 0,
              "id": "p3",
              "name": "Zeta App",
              "totalSeconds": 3600,
              "users": [
                {
                  "billableSeconds": 0,
                  "id": "u1",
                  "name": "User u1",
                  "totalSeconds": 3600,
                },
              ],
            },
          ],
          "totalSeconds": 3600,
        },
      ]
    `)
  })

  it('rejects billable time that is missing from, or exceeds, total time', () => {
    const all = [
      client('c1', 'Acme', [project('p1', 'App', [user('u1', HOUR_SECONDS)])]),
    ]

    const missing = [
      client('c2', 'Other', [project('p9', 'X', [user('u1', MINUTE_SECONDS)])]),
    ]
    const exceeding = [
      client('c1', 'Acme', [
        project('p1', 'App', [user('u1', HOUR_SECONDS + 1)]),
      ]),
    ]

    expect(() =>
      buildOverview(all, missing),
    ).toThrowErrorMatchingInlineSnapshot(`[Error: Billable group "Other" (c2) missing from total time]`)
    expect(() =>
      buildOverview(all, exceeding),
    ).toThrowErrorMatchingInlineSnapshot(`[Error: "Acme" has more billable (3601s) than total (3600s) time]`)
  })

  it('rejects duplicate group ids', () => {
    const all = [
      client('c1', 'Acme', [
        project('p1', 'App', [user('u1', MINUTE_SECONDS)]),
      ]),
      client('c1', 'Acme again', [
        project('p2', 'App', [user('u1', MINUTE_SECONDS)]),
      ]),
    ]
    expect(() => buildOverview(all, [])).toThrowErrorMatchingInlineSnapshot(`[Error: Duplicate Clockify summary group ids: c1, c1]`)
  })

  it('moves the no-client Internal project under Bearing', () => {
    const all = [
      client('', '', [
        project('p1', 'Internal', [user('u1', HOUR_SECONDS)]),
        project('p2', 'Unassigned', [user('u1', 10 * MINUTE_SECONDS)]),
      ]),
      client('c1', 'Acme', [
        project('p3', 'App', [user('u1', HOUR_SECONDS / 2)]),
      ]),
    ]
    expect(buildOverview(all, [])).toMatchInlineSnapshot(`
      [
        {
          "billableSeconds": 0,
          "id": "",
          "name": "",
          "projects": [
            {
              "billableSeconds": 0,
              "id": "p2",
              "name": "Unassigned",
              "totalSeconds": 600,
              "users": [
                {
                  "billableSeconds": 0,
                  "id": "u1",
                  "name": "User u1",
                  "totalSeconds": 600,
                },
              ],
            },
          ],
          "totalSeconds": 600,
        },
        {
          "billableSeconds": 0,
          "id": "c1",
          "name": "Acme",
          "projects": [
            {
              "billableSeconds": 0,
              "id": "p3",
              "name": "App",
              "totalSeconds": 1800,
              "users": [
                {
                  "billableSeconds": 0,
                  "id": "u1",
                  "name": "User u1",
                  "totalSeconds": 1800,
                },
              ],
            },
          ],
          "totalSeconds": 1800,
        },
        {
          "billableSeconds": 0,
          "id": "Bearing",
          "name": "Bearing",
          "projects": [
            {
              "billableSeconds": 0,
              "id": "p1",
              "name": "Internal",
              "totalSeconds": 3600,
              "users": [
                {
                  "billableSeconds": 0,
                  "id": "u1",
                  "name": "User u1",
                  "totalSeconds": 3600,
                },
              ],
            },
          ],
          "totalSeconds": 3600,
        },
      ]
    `)
  })
})
