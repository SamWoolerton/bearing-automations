const DOLLARS = new Intl.NumberFormat('en-NZ', {
  style: 'currency',
  currency: 'NZD',
  currencyDisplay: 'narrowSymbol',
  maximumFractionDigits: 0,
})

export const formatDollars = (amount: number) => DOLLARS.format(amount)
