export type WithValueOnChange<Props, Value> = Omit<Props, 'onChange'> & {
  onChange?: (value: Value) => void
}
