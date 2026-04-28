// Helpers de formato monetario para el módulo Envíos.

export function formatAmount(value: number, decimalPlaces = 2, options?: { showSign?: boolean }): string {
  const opts = { showSign: false, ...options };
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("es-MX", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });
  if (!opts.showSign) {
    if (value < 0) return `−${formatted}`;
    return formatted;
  }
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `−${formatted}`;
  return formatted;
}

export function formatAmountWithSymbol(value: number, symbol: string, decimalPlaces = 2): string {
  const isNegative = value < 0;
  const formatted = formatAmount(Math.abs(value), decimalPlaces);
  return isNegative ? `−${symbol}${formatted}` : `${symbol}${formatted}`;
}

export function formatCurrencyCode(code: string, value: number, decimalPlaces = 2): string {
  return `${formatAmount(value, decimalPlaces)} ${code}`;
}
