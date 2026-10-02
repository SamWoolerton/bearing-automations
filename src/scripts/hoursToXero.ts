import { assert } from '@bearing-agency/utilities/assertions'

import { format, getDate } from 'date-fns'

import type { ClientConfig, ClockifyClientConfig } from '@/billing/clientConfig'
import {
  CLIENTS,
  clockifyMappingFor,
  INACTIVE_CLOCKIFY_CLIENTS,
  SKIP_CLOCKIFY_CLIENTS,
} from '@/billing/clientConfig'
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
import { includesName, normaliseName, sameName } from '@/lib/names'
import { nowInNZ, priorMonth } from '@/lib/periods'

const DUPLICATE_PROJECT_SUFFIX = /\s+(?:2|copy|\(copy\))$/i

const SALES_ACCOUNT_CODE = '200'
const NZ_GST_ON_INCOME_TAX_TYPE = 'OUTPUT2'
const ZERO_RATED_INCOME_TAX_TYPE = 'ZERORATED'

const LAST_SYNC_DAY_OF_MONTH = 10

const now = nowInNZ()
const period = priorMonth(now)

type Plan = {
  cfg: ClientConfig
  contact: XeroContact
  draft?: XeroInvoice
  lines: XeroNewLineItem[]
}

async function main() {
  const day = getDate(now)
  assert(
    day <= LAST_SYNC_DAY_OF_MONTH,
    `Today is day ${day} of the month — only sync on days 1 to ${LAST_SYNC_DAY_OF_MONTH}`,
  )

  console.log(
    `Period: ${period.label} (${period.start.toISOString()} → ${period.end.toISOString()})  DRY_RUN=${env.DRY_RUN}  ONLY_CLIENT=${env.ONLY_CLIENT ?? '(all)'}`,
  )
  const { ONLY_CLIENT } = env
  if (ONLY_CLIENT)
    assert(
      CLIENTS.some(c => sameName(c.xero, ONLY_CLIENT)),
      `ONLY_CLIENT "${ONLY_CLIENT}" doesn't match any client's Xero name`,
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

    const mapping = clockifyMappingFor(client.name)
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
    if (draft && draft.CurrencyCode !== cfg.currency) {
      errors.push(
        `"${cfg.xero}" draft is in ${draft.CurrencyCode} but config says ${cfg.currency}`,
      )
      continue
    }

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
        TaxType:
          cfg.currency === 'NZD'
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

    const selected = !ONLY_CLIENT || sameName(cfg.xero, ONLY_CLIENT)
    if (lines.length && selected) plans.push({ cfg, contact, draft, lines })
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
        Date: format(period.end, 'yyyy-MM-dd'),
        Reference: p.cfg.poNumber ?? '',
        LineAmountTypes: 'Exclusive',
        CurrencyCode: p.cfg.currency,
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
