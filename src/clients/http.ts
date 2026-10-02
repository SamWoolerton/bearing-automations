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
