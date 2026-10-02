import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export type WithValueOnChange<Props, Value> = Omit<Props, 'onChange'> & {
  onChange?: (value: Value) => void
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
