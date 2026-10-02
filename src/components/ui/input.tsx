import type { WithValueOnChange } from '@/lib/utils'
import { cn } from 'cn'
import * as React from 'react'

type InputProps = WithValueOnChange<React.ComponentProps<'input'>, string>

function Input({ className, type, onChange, ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      onChange={(e) => onChange?.(e.target.value)}
      className={cn(
        'h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
        className,
      )}
      {...props}
    />
  )
}

type NumberInputProps = WithValueOnChange<
  Omit<InputProps, 'type' | 'value'> & { value?: number | null },
  number | null
>

function NumberInput({ value, onChange, ...props }: NumberInputProps) {
  return (
    <Input
      {...props}
      type="number"
      value={value === null ? '' : value}
      onChange={(v) => onChange?.(v === '' ? null : Number(v))}
    />
  )
}

export { Input, NumberInput }
