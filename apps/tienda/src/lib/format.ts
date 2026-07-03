export function fmt(n: number): string {
  return "$" + n.toFixed(2);
}

export interface StockInfo {
  label: string;
  color: string;
}

export function stockInfo(stockAvailable: number): StockInfo {
  if (stockAvailable <= 0) {
    return { label: "Agotado", color: "#B54A5E" };
  }
  if (stockAvailable < 10) {
    return {
      label: `Pocas unidades · quedan ${stockAvailable}`,
      color: "#B07B2E",
    };
  }
  return { label: "En stock", color: "#1E7A4F" };
}
