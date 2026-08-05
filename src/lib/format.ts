export function formatCurrencyCents(cents: number): string {
  const dollars = cents / 100;
  if (Math.abs(dollars) >= 1000) {
    return `$${(dollars / 1000).toFixed(dollars % 1000 === 0 ? 0 : 1)}k`;
  }
  return `$${dollars.toFixed(0)}`;
}

export function formatDelta(percent: number): string {
  const sign = percent > 0 ? '+' : '';
  return `${sign}${percent.toFixed(percent % 1 === 0 ? 0 : 1)}%`;
}

export function formatMetricValue(value: number, unit: 'hours' | 'usd' | 'count' | 'percent'): string {
  switch (unit) {
    case 'hours':
      return `${value.toFixed(value % 1 === 0 ? 0 : 1)}h`;
    case 'usd':
      return formatCurrencyCents(value * 100);
    case 'percent':
      return `${value.toFixed(0)}%`;
    case 'count':
      return value.toFixed(0);
  }
}