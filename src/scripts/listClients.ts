import { compareStringAsc } from '@bearing-agency/utilities/sort'

import { getClients } from '@/clients/clockify'
import { getContacts } from '@/clients/xero'

const sortedNames = (names: string[]) => names.toSorted(compareStringAsc)

async function main() {
  const [clockifyClients, xeroContacts] = await Promise.all([
    getClients(),
    getContacts(),
  ])

  console.log(`Clockify clients (${clockifyClients.length}):`)
  for (const name of sortedNames(
    clockifyClients.map(c => (c.archived ? `${c.name} (archived)` : c.name)),
  ))
    console.log(`  ${name}`)

  console.log(`\nXero contacts (${xeroContacts.length}):`)
  for (const name of sortedNames(xeroContacts.map(c => c.Name)))
    console.log(`  ${name}`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
