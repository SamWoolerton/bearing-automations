import ky from 'ky'
import z from 'zod'

import { appendResponseBodyToError } from '@/clients/http'
import { env } from '@/env'

const tokenSchema = z.object({ access_token: z.string().min(1) })

let accessToken: Promise<string> | undefined

function getAccessToken() {
  const credentials = Buffer.from(
    `${env.XERO_CLIENT_ID}:${env.XERO_CLIENT_SECRET}`,
  ).toString('base64')
  accessToken ??= ky
    .post('https://identity.xero.com/connect/token', {
      headers: { Authorization: `Basic ${credentials}` },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
      retry: { methods: ['post'] },
      hooks: { beforeError: [appendResponseBodyToError] },
    })
    .json(tokenSchema)
    .then(t => t.access_token)
  return accessToken
}

// Don't retry POSTs: if the first attempt landed, a retry duplicates the invoice or its new lines
const api = ky.create({
  prefix: 'https://api.xero.com/api.xro/2.0/',
  headers: { Accept: 'application/json' },
  hooks: {
    beforeRequest: [
      async ({ request }) => {
        request.headers.set('Authorization', `Bearer ${await getAccessToken()}`)
      },
    ],
    beforeError: [appendResponseBodyToError],
  },
})

const PAGE_SIZE = 100

async function getAllPages<T>(
  fetchPage: (params: { page: number; pageSize: number }) => Promise<T[]>,
) {
  const all: T[] = []
  for (let page = 1; ; page++) {
    const items = await fetchPage({ page, pageSize: PAGE_SIZE })
    all.push(...items)
    if (items.length < PAGE_SIZE) return all
  }
}

const contactSchema = z.object({
  ContactID: z.string(),
  Name: z.string(),
})

export type XeroContact = z.infer<typeof contactSchema>

export function getContacts() {
  return getAllPages(async pagination => {
    const res = await api
      .get('Contacts', { searchParams: { summaryOnly: true, ...pagination } })
      .json(z.object({ Contacts: z.array(contactSchema) }))
    return res.Contacts
  })
}

// Loose: unmodelled fields must survive being sent back, or replaceInvoiceLineItems deletes them
const lineItemSchema = z.looseObject({
  LineItemID: z.string(),
  Description: z.string(),
  Quantity: z.number(),
  UnitAmount: z.number(),
})

export type XeroLineItem = z.infer<typeof lineItemSchema>

export type XeroNewLineItem = {
  Description: string
  Quantity: number
  UnitAmount: number
  AccountCode: string
  TaxType: string
}

const invoiceSchema = z.object({
  InvoiceID: z.string(),
  InvoiceNumber: z.string().optional(),
  Contact: z.object({ ContactID: z.string() }),
  LineItems: z.array(lineItemSchema),
})

export type XeroInvoice = z.infer<typeof invoiceSchema>

const singleInvoiceResponseSchema = z.object({
  Invoices: z.tuple([invoiceSchema]),
})

export function getDraftSalesInvoices() {
  return getAllPages(async pagination => {
    const res = await api
      .get('Invoices', {
        searchParams: {
          Statuses: 'DRAFT',
          where: 'Type=="ACCREC"',
          ...pagination,
        },
      })
      .json(z.object({ Invoices: z.array(invoiceSchema) }))
    return res.Invoices
  })
}

export async function createDraftSalesInvoice(invoice: {
  ContactID: string
  Date: string
  Reference: string
  LineAmountTypes: 'Exclusive' | 'Inclusive' | 'NoTax'
  LineItems: XeroNewLineItem[]
}) {
  const { ContactID, ...rest } = invoice
  const res = await api
    .post('Invoices', {
      json: {
        Invoices: [
          { Type: 'ACCREC', Status: 'DRAFT', Contact: { ContactID }, ...rest },
        ],
      },
    })
    .json(singleInvoiceResponseSchema)
  return res.Invoices[0]
}

export async function replaceInvoiceLineItems(
  invoiceId: string,
  lineItems: (XeroLineItem | XeroNewLineItem)[],
) {
  const res = await api
    .post(`Invoices/${invoiceId}`, {
      json: { Invoices: [{ InvoiceID: invoiceId, LineItems: lineItems }] },
    })
    .json(singleInvoiceResponseSchema)
  return res.Invoices[0]
}
