import { unique } from '@bearing-agency/utilities/arrays'
import { assert } from '@bearing-agency/utilities/assertions'

import { normaliseName, sameName } from '@/lib/names'

export type ClockifyClientConfig = {
  name: string
  prefixProjectWithClient?: true
}

export type ClientConfig = {
  clockify: (string | ClockifyClientConfig)[]
  xero: string
  hourlyRate: number
  inNZ: boolean
  poNumber?: string
}

export const CLIENTS: ClientConfig[] = [
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

export const hourlyRateFor = (clockifyClient: string) =>
  clockifyMappingFor(clockifyClient)?.cfg.hourlyRate ?? null

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
