import { unique } from '@bearing-agency/utilities/arrays'
import { assert } from '@bearing-agency/utilities/assertions'

import { TZDate } from '@date-fns/tz'
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns'

import type { ClockifyClientTime } from '@/clients/clockify'
import {
  getBillableTimeByClientAndProject,
  roundBillableHours,
} from '@/clients/clockify'
import type { XeroContact, XeroInvoice, XeroNewLineItem } from '@/clients/xero'
import {
  createDraftSalesInvoice,
  getContacts,
  getDraftSalesInvoices,
  replaceInvoiceLineItems,
} from '@/clients/xero'
import { env } from '@/env'

type ClockifyClientConfig = {
  name: string
  prefixProjectWithClient?: true
}

type ClientConfig = {
  clockify: (string | ClockifyClientConfig)[]
  xero: string
  hourlyRate: number
  inNZ: boolean
  poNumber?: string
}

const CLIENTS: ClientConfig[] = [
  {
    clockify: ['Acme'],
    xero: 'Acme Limited',
    hourlyRate: 150,
    inNZ: true,
    poNumber: 'PO-12345',
  },
  {
    clockify: ['Globex'],
    xero: 'Globex Corporation',
    hourlyRate: 175,
    inNZ: false,
  },
]
const SKIP_CLOCKIFY_CLIENTS = ['Fixed Price Client']
const INACTIVE_CLOCKIFY_CLIENTS = ['EIP', 'Energy Impact Partners']

const SALES_ACCOUNT_CODE = '200'
const NZ_GST_ON_INCOME_TAX_TYPE = 'OUTPUT2'
const ZERO_RATED_INCOME_TAX_TYPE = 'ZERORATEDOUTPUT'
const TZ = 'Pacific/Auckland'

const normaliseName = (name: string) => name.trim().toLowerCase()
const sameName = (a: string, b: string) => normaliseName(a) === normaliseName(b)
const includesName = (names: string[], name: string) =>
  names.some(n => sameName(n, name))

const CLOCKIFY_MAPPINGS = CLIENTS.flatMap(cfg =>
  cfg.clockify.map(c => ({
    cfg,
    ...(typeof c === 'string' ? { name: c } : c),
  })),
)

const assertNoDuplicateNames = (names: string[], label: string) =>
  assert(
    unique(names.map(normaliseName)).length === names.length,
    `Duplicate ${label} name in config`,
  )
assertNoDuplicateNames(
  [
    ...CLOCKIFY_MAPPINGS.map(m => m.name),
    ...SKIP_CLOCKIFY_CLIENTS,
    ...INACTIVE_CLOCKIFY_CLIENTS,
  ],
  'Clockify client',
)
assertNoDuplicateNames(
  CLIENTS.map(c => c.xero),
  'Xero contact',
)

const now = TZDate.tz(TZ)
const lastMonth = subMonths(now, 1)
const periodStart = startOfMonth(lastMonth)
const periodEnd = endOfMonth(lastMonth)
const periodLabel = format(periodStart, 'MMMM yyyy')

type Plan = {
  cfg: ClientConfig
  contact: XeroContact
  draft?: XeroInvoice
  lines: XeroNewLineItem[]
}

async function main() {
  console.log(
    `Period: ${periodLabel} (${periodStart.toISOString()} → ${periodEnd.toISOString()})  DRY_RUN=${env.DRY_RUN}`,
  )

  const time = await getBillableTimeByClientAndProject({
    start: periodStart,
    end: periodEnd,
  })
  const contacts = await getContacts()
  const drafts = await getDraftSalesInvoices()

  const errors: string[] = []
  const contactFor = new Map<ClientConfig, XeroContact>()

  for (const cfg of CLIENTS) {
    const matches = contacts.filter(c => sameName(c.Name, cfg.xero))
    if (matches.length !== 1)
      errors.push(
        `Xero contact "${cfg.xero}": ${matches.length} matches (need 1)`,
      )
    else contactFor.set(cfg, matches[0])
  }

  const timeFor = new Map<
    ClientConfig,
    ({ client: ClockifyClientTime } & Pick<
      ClockifyClientConfig,
      'prefixProjectWithClient'
    >)[]
  >()

  for (const client of time) {
    if (includesName(SKIP_CLOCKIFY_CLIENTS, client.name)) continue
    if (includesName(INACTIVE_CLOCKIFY_CLIENTS, client.name)) {
      console.warn(
        `⚠ Inactive Clockify client "${client.name}" has ${(client.duration / 3600).toFixed(2)}h billable — not invoiced, check for misclassified time`,
      )
      continue
    }

    const mapping = CLOCKIFY_MAPPINGS.find(m => sameName(m.name, client.name))
    if (!mapping) {
      errors.push(
        `Clockify client "${client.name || '(no client)'}" not in config or skip list`,
      )
      continue
    }
    const { cfg, prefixProjectWithClient } = mapping
    timeFor.set(cfg, [
      ...(timeFor.get(cfg) ?? []),
      { client, prefixProjectWithClient },
    ])
  }

  const plans: Plan[] = []

  for (const [cfg, clients] of timeFor) {
    const contact = contactFor.get(cfg)
    if (!contact) continue

    const clientDrafts = drafts.filter(
      d => d.Contact.ContactID === contact.ContactID,
    )
    if (clientDrafts.length > 1) {
      errors.push(
        `"${cfg.xero}" has ${clientDrafts.length} draft invoices — resolve manually`,
      )
      continue
    }
    const draft = clientDrafts.at(0)

    const lines: XeroNewLineItem[] = []
    const seenDescriptions = new Set<string>()
    for (const { client, prefixProjectWithClient } of clients)
      for (const project of client.children) {
        const hours = roundBillableHours(project.duration)
        if (hours === 0) continue

        if (!project.name)
          errors.push(`"${client.name}" has a project without a name`)

        const description = prefixProjectWithClient
          ? `${client.name} - ${project.name}`
          : project.name
        if (seenDescriptions.has(normaliseName(description))) {
          errors.push(
            `"${cfg.xero}" has multiple Clockify projects named "${description}"`,
          )
          continue
        }
        seenDescriptions.add(normaliseName(description))

        const line: XeroNewLineItem = {
          Description: description,
          Quantity: hours,
          UnitAmount: cfg.hourlyRate,
          AccountCode: SALES_ACCOUNT_CODE,
          TaxType: cfg.inNZ
            ? NZ_GST_ON_INCOME_TAX_TYPE
            : ZERO_RATED_INCOME_TAX_TYPE,
        }

        const existing = (draft?.LineItems ?? []).filter(e =>
          sameName(e.Description, line.Description),
        )
        assert(
          existing.length <= 1,
          `"${cfg.xero}" draft has ${existing.length} lines for "${line.Description}"`,
        )
        if (existing.length === 0) {
          lines.push(line)
          continue
        }
        const [{ Quantity, UnitAmount }] = existing
        assert(
          Quantity === line.Quantity && UnitAmount === line.UnitAmount,
          `"${cfg.xero}" draft line "${line.Description}" is ${Quantity}h × $${UnitAmount} but Clockify says ${line.Quantity}h × $${line.UnitAmount}`,
        )
      }

    if (lines.length) plans.push({ cfg, contact, draft, lines })
  }

  if (errors.length)
    throw new Error(`Aborting — nothing written:\n  ${errors.join('\n  ')}`)

  for (const p of plans) {
    const action = p.draft
      ? `ADD to draft ${p.draft.InvoiceNumber ?? p.draft.InvoiceID}`
      : 'CREATE new draft'
    console.log(`\n${p.cfg.xero}: ${action}`)
    for (const l of p.lines)
      console.log(`  ${l.Description}: ${l.Quantity}h × $${l.UnitAmount}`)
  }
  if (!plans.length) console.log('Nothing to do.')
  if (env.DRY_RUN) return console.log('\nDry run — set DRY_RUN=false to write.')

  for (const p of plans) {
    if (p.draft) {
      await replaceInvoiceLineItems(p.draft.InvoiceID, [
        ...p.draft.LineItems,
        ...p.lines,
      ])
    } else {
      await createDraftSalesInvoice({
        ContactID: p.contact.ContactID,
        Date: format(now, 'yyyy-MM-dd'),
        Reference: p.cfg.poNumber ?? '',
        LineAmountTypes: 'Exclusive',
        LineItems: p.lines,
      })
    }
    console.log(`✔ ${p.cfg.xero}`)
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
