import type { BeforeErrorHook } from 'ky'
import { isHTTPError } from 'ky'

export const appendResponseBodyToError: BeforeErrorHook = ({ error }) => {
  if (isHTTPError(error) && error.data !== undefined) {
    const body =
      typeof error.data === 'string' ? error.data : JSON.stringify(error.data)
    error.message += `\n${body}`
  }
  return error
}

const PAGE_SIZE = 100

export async function getAllPages<T>(
  fetchPage: (params: { page: number; pageSize: number }) => Promise<T[]>,
) {
  const all: T[] = []
  for (let page = 1; ; page++) {
    const items = await fetchPage({ page, pageSize: PAGE_SIZE })
    all.push(...items)
    if (items.length < PAGE_SIZE) return all
  }
}
