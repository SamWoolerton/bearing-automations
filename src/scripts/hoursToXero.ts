import { unique } from '@bearing-agency/utilities/arrays'
import { assert } from '@bearing-agency/utilities/assertions'

import { format } from 'date-fns'

import type { ClockifyClientTime } from '@/clients/clockify'
import { getBillableTimeByClientAndProject } from '@/clients/clockify'
import type { XeroContact, XeroInvoice, XeroNewLineItem } from '@/clients/xero'
import {
  createDraftSalesInvoice,
  getContacts,
  getDraftSalesInvoices,
  replaceInvoiceLineItems,
} from '@/clients/xero'
import { env } from '@/env'
import { formatHours, roundBillableHours } from '@/lib/hours'
import { nowInNZ, priorMonth } from '@/lib/periods'

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
    clockify: ['Azlock'],
    xero: 'Clovelly Star Limited',
    hourlyRate: 170,
    inNZ: true,
  },
  { clockify: ['Charge On'], xero: 'Charge On', hourlyRate: 95, inNZ: false },
  { clockify: ['EAS'], xero: 'EAS', hourlyRate: 170, inNZ: false },
  {
    clockify: ['FSS'],
    xero: 'Fire Security Services (FSS)',
    hourlyRate: 170,
    inNZ: true,
  },
  { clockify: ['Fosters'], xero: 'Fosters', hourlyRate: 150, inNZ: true },
  {
    clockify: ['Give Power', 'GivePower'],
    xero: 'GivePower',
    hourlyRate: 125,
    inNZ: false,
  },
  { clockify: ['GoodFinch'], xero: 'GoodFinch', hourlyRate: 110, inNZ: false },
  { clockify: ['HG Leach'], xero: 'HG Leach', hourlyRate: 170, inNZ: true },
  {
    clockify: ['Health Bank'],
    xero: 'Health Bank',
    hourlyRate: 150,
    inNZ: false,
  },
  {
    clockify: ['IT Partners'],
    xero: 'IT Partners',
    hourlyRate: 160,
    inNZ: true,
  },
  {
    clockify: ['Livingstone'],
    xero: 'Livingstone Building NZ Ltd',
    hourlyRate: 170,
    inNZ: true,
  },
  { clockify: ['Madimack'], xero: 'Madimack', hourlyRate: 140, inNZ: false },
  {
    clockify: ['Get Freighted'],
    xero: 'Mipco Pty Ltd',
    hourlyRate: 170,
    inNZ: false,
  },
  { clockify: ['Caliber'], xero: 'Namaco', hourlyRate: 115, inNZ: true },
  {
    clockify: ['Prime Innovation'],
    xero: 'Prime Innovation',
    hourlyRate: 170,
    inNZ: true,
  },
  {
    clockify: [
      'Resolution8',
      { name: 'ConneXu', prefixProjectWithClient: true },
    ],
    xero: 'Resolution8 Limited',
    hourlyRate: 170,
    inNZ: true,
  },
  {
    clockify: ['RB'],
    xero: 'Revolution Boutique',
    hourlyRate: 125,
    inNZ: false,
  },
  {
    clockify: ['Sunstrong'],
    xero: 'Sunstrong Management',
    hourlyRate: 110,
    inNZ: false,
  },
  {
    clockify: ['TLC'],
    xero: 'The Lines Company (TLC)',
    hourlyRate: 170,
    inNZ: true,
    poNumber: 'PO063581',
  },
  {
    clockify: ['Tompkins Wake'],
    xero: 'Tompkins Wake',
    hourlyRate: 185,
    inNZ: true,
  },
]
const SKIP_CLOCKIFY_CLIENTS = ['Bearing', 'Coastal Medical']
const INACTIVE_CLOCKIFY_CLIENTS = ['EIP', 'Energy Impact Partners', 'Resonate']

const DUPLICATE_PROJECT_SUFFIX = /\s+(?:2|copy)$/i

const SALES_ACCOUNT_CODE = '200'
const NZ_GST_ON_INCOME_TAX_TYPE = 'OUTPUT2'
const ZERO_RATED_INCOME_TAX_TYPE = 'ZERORATEDOUTPUT'

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

const now = nowInNZ()
const period = priorMonth(now)

type Plan = {
  cfg: ClientConfig
  contact: XeroContact
  draft?: XeroInvoice
  lines: XeroNewLineItem[]
}

async function main() {
  console.log(
    `Period: ${period.label} (${period.start.toISOString()} → ${period.end.toISOString()})  DRY_RUN=${env.DRY_RUN}`,
  )

  const time = await getBillableTimeByClientAndProject(period)
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
        `⚠ Inactive Clockify client "${client.name}" has ${formatHours(client.duration)}h billable — not invoiced, check for misclassified time`,
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

    const projects: { description: string; seconds: number }[] = []
    for (const { client, prefixProjectWithClient } of clients) {
      for (const project of client.children) {
        if (!project.name && roundBillableHours(project.duration) > 0)
          errors.push(`"${client.name}" has a project without a name`)

        projects.push({
          description: prefixProjectWithClient
            ? `${client.name} - ${project.name}`
            : project.name,
          seconds: project.duration,
        })
      }
    }

    const descriptionFor = new Map(
      projects.map(p => [normaliseName(p.description), p.description]),
    )
    const secondsFor = new Map<string, number>()
    const canonicalDescription = (description: string) =>
      descriptionFor.get(normaliseName(description))
    for (const project of projects) {
      const description =
        canonicalDescription(
          project.description.replace(DUPLICATE_PROJECT_SUFFIX, ''),
        ) ?? canonicalDescription(project.description)
      assert(
        description !== undefined,
        `No description found for "${project.description}"`,
      )
      if (!sameName(description, project.description))
        console.log(
          `${cfg.xero}: merging "${project.description}" into "${description}"`,
        )
      secondsFor.set(
        description,
        (secondsFor.get(description) ?? 0) + project.seconds,
      )
    }

    const lines: XeroNewLineItem[] = []
    for (const [description, seconds] of secondsFor) {
      const hours = roundBillableHours(seconds)
      if (hours === 0) continue

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
