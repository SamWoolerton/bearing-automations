export const formatMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)

export const formatDollars = (amount: number) => formatMoney(amount, 'NZD')
