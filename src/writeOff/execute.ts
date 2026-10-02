import { zip } from '@bearing-agency/utilities/arrays'
import { assert } from '@bearing-agency/utilities/assertions'
import { oxfordAnd } from '@bearing-agency/utilities/strings'

import z from 'zod'

import type {
  ClockifyReportTimeEntry,
  ClockifyTimeEntry,
} from '@/clients/clockify'
import {
  createTimeEntryForUser,
  deleteTimeEntry,
  getTimeEntry,
  timeEntryInputSchema,
  toTimeEntryInput,
  updateTimeEntry,
} from '@/clients/clockify'
import type { WriteOffPlan } from '@/writeOff/plan'

import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const LOG_DIR = path.join(process.cwd(), 'temp', 'write-offs')

const changeLogSchema = z.object({
  id: z.string(),
  createdAt: z.iso.datetime(),
  plan: z.unknown(),
  items: z.array(
    z.object({
      kind: z.enum(['markNonBillable', 'split']),
      entryId: z.string(),
      original: timeEntryInputSchema,
      createdEntryId: z.string().optional(),
      createdEntryDeleted: z.boolean().optional(),
      restored: z.boolean().optional(),
    }),
  ),
  error: z.string().optional(),
})

export type ChangeLog = z.infer<typeof changeLogSchema>

function logPath(id: string) {
  assert(/^[\w-]+$/.test(id), `Invalid change log id "${id}"`)
  return path.join(LOG_DIR, `${id}.json`)
}

async function saveLog(log: ChangeLog) {
  await mkdir(LOG_DIR, { recursive: true })
  await writeFile(logPath(log.id), JSON.stringify(log, null, 2))
}

export async function loadChangeLog(id: string) {
  return changeLogSchema.parse(JSON.parse(await readFile(logPath(id), 'utf8')))
}

const sameInstant = (a: string, b: string) => Date.parse(a) === Date.parse(b)

function assertUnchangedSincePlan(
  live: ClockifyTimeEntry,
  planned: ClockifyReportTimeEntry,
) {
  const problems = [
    !live.billable && 'is no longer billable',
    live.isLocked && 'is locked',
    !sameInstant(live.timeInterval.start, planned.timeInterval.start) &&
      'start has changed',
    !sameInstant(live.timeInterval.end, planned.timeInterval.end) &&
      'end has changed',
    live.userId !== planned.userId && 'user has changed',
    live.projectId !== (planned.projectId ?? null) && 'project has changed',
    (live.customFieldValues?.length ?? 0) > 0 &&
      'has custom field values, which updating would erase',
  ].filter(p => typeof p === 'string')
  assert(
    problems.length === 0,
    `Entry ${live.id} ${oxfordAnd(problems)} — nothing written, re-plan and try again`,
  )
}

const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : String(e)

export async function executeWriteOff(plan: WriteOffPlan) {
  const liveEntries = []
  for (const op of plan.ops) liveEntries.push(await getTimeEntry(op.entry._id))
  for (const [op, live] of zip(plan.ops, liveEntries))
    assertUnchangedSincePlan(live, op.entry)

  const createdAt = new Date().toISOString()
  const log: ChangeLog = {
    id: `${createdAt.replaceAll(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`,
    createdAt,
    plan,
    items: [],
  }
  await saveLog(log)

  try {
    for (const [op, live] of zip(plan.ops, liveEntries)) {
      const original = toTimeEntryInput(live)
      const item: ChangeLog['items'][number] = {
        kind: op.kind,
        entryId: live.id,
        original,
      }
      log.items.push(item)
      await saveLog(log)

      if (op.kind === 'markNonBillable') {
        await updateTimeEntry(live.id, { ...original, billable: false })
        continue
      }
      // Shorten first: if creating the remainder then fails, billable time is still correct
      const splitAt = new Date(
        Date.parse(original.start) + op.billableSeconds * 1000,
      ).toISOString()
      await updateTimeEntry(live.id, { ...original, end: splitAt })
      const created = await createTimeEntryForUser(live.userId, {
        ...original,
        start: splitAt,
        billable: false,
      })
      item.createdEntryId = created.id
      await saveLog(log)
    }
  } catch (e) {
    log.error = errorMessage(e)
    await saveLog(log)
  }
  return log
}

export async function undoWriteOff(id: string) {
  const log = await loadChangeLog(id)
  for (const item of log.items.toReversed()) {
    if (item.createdEntryId && !item.createdEntryDeleted) {
      await deleteTimeEntry(item.createdEntryId)
      item.createdEntryDeleted = true
      await saveLog(log)
    }
    if (!item.restored) {
      await updateTimeEntry(item.entryId, item.original)
      item.restored = true
      await saveLog(log)
    }
  }
  return log
}
