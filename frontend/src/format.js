export function formatCurrency(value) {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

export function formatPercent(value, digits = 2) {
  if (value === null || value === undefined) return '—'
  return `${(value * 100).toFixed(digits)}%`
}
