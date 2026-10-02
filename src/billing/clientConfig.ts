import { unique } from '@bearing-agency/utilities/arrays'
import { assert } from '@bearing-agency/utilities/assertions'
import { mapNullish } from '@bearing-agency/utilities/nullish'

import { normaliseName, sameName } from '@/lib/names'

export type ClockifyClientConfig = {
  name: string
  prefixProjectWithClient?: true
}

export const NZD_PER_UNIT = { NZD: 1, USD: 1.73, AUD: 1.15, CAD: 1.22 }
export type Currency = keyof typeof NZD_PER_UNIT

export type ClientConfig = {
  clockify: (string | ClockifyClientConfig)[]
  xero: string
  hourlyRate: number
  currency: Currency
  poNumber?: string
}

export const CLIENTS: ClientConfig[] = [
  {
    clockify: ['Azlock'],
    xero: 'Clovelly Star Limited',
    hourlyRate: 170,
    currency: 'NZD',
  },
  {
    clockify: ['Charge On'],
    xero: 'Charge On',
    hourlyRate: 95,
    currency: 'USD',
  },
  { clockify: ['EAS'], xero: 'EAS', hourlyRate: 170, currency: 'NZD' },
  {
    clockify: ['FSS'],
    xero: 'Fire Security Services (FSS)',
    hourlyRate: 170,
    currency: 'NZD',
  },
  { clockify: ['Fosters'], xero: 'Fosters', hourlyRate: 150, currency: 'NZD' },
  {
    clockify: ['Give Power', 'GivePower'],
    xero: 'GivePower',
    hourlyRate: 125,
    currency: 'USD',
  },
  {
    clockify: ['GoodFinch'],
    xero: 'GoodFinch',
    hourlyRate: 110,
    currency: 'USD',
  },
  {
    clockify: ['HG Leach'],
    xero: 'HG Leach',
    hourlyRate: 170,
    currency: 'NZD',
  },
  {
    clockify: ['IT Partners'],
    xero: 'IT Partners',
    hourlyRate: 160,
    currency: 'NZD',
  },
  {
    clockify: ['Livingstone'],
    xero: 'Livingstone Building NZ Ltd',
    hourlyRate: 170,
    currency: 'NZD',
  },
  {
    clockify: ['Madimack'],
    xero: 'Madimack',
    hourlyRate: 140,
    currency: 'AUD',
  },
  {
    clockify: ['Get Freighted'],
    xero: 'Mipco Pty Ltd',
    hourlyRate: 170,
    currency: 'AUD',
  },
  { clockify: ['Caliber'], xero: 'Namaco', hourlyRate: 115, currency: 'NZD' },
  {
    clockify: ['Prime Innovation'],
    xero: 'Prime Innovation',
    hourlyRate: 170,
    currency: 'NZD',
  },
  {
    clockify: [
      'Resolution8',
      { name: 'ConneXu', prefixProjectWithClient: true },
    ],
    xero: 'Resolution8 Limited',
    hourlyRate: 170,
    currency: 'NZD',
  },
  {
    clockify: ['RB'],
    xero: 'Revolution Boutique',
    hourlyRate: 125,
    currency: 'CAD',
  },
  {
    clockify: ['Sunstrong'],
    xero: 'Sunstrong Management',
    hourlyRate: 110,
    currency: 'USD',
  },
  {
    clockify: ['TLC'],
    xero: 'The Lines Company (TLC)',
    hourlyRate: 170,
    currency: 'NZD',
    poNumber: 'PO063581',
  },
  {
    clockify: ['Tompkins Wake'],
    xero: 'Tompkins Wake',
    hourlyRate: 185,
    currency: 'NZD',
  },
]
export const SKIP_CLOCKIFY_CLIENTS = [
  'Bearing',
  'Coastal Medical',
  'Health Bank',
]
export const INACTIVE_CLOCKIFY_CLIENTS = [
  'EIP',
  'Energy Impact Partners',
  'Resonate',
]

const CLOCKIFY_MAPPINGS = CLIENTS.flatMap(cfg =>
  cfg.clockify.map(c => ({
    cfg,
    ...(typeof c === 'string' ? { name: c } : c),
  })),
)

export const clockifyMappingFor = (clockifyClient: string) =>
  CLOCKIFY_MAPPINGS.find(m => sameName(m.name, clockifyClient))

export const nzdHourlyRateFor = (clockifyClient: string) =>
  mapNullish(
    clockifyMappingFor(clockifyClient)?.cfg,
    cfg => cfg.hourlyRate * NZD_PER_UNIT[cfg.currency],
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
