import { cn } from "@/lib/utils";

const LOW_STOCK_THRESHOLD = 5;

interface StockLabelProps {
  stock: number;
  className?: string;
}

export function stockText(stock: number): string {
  if (stock <= 0) return "Agotado";
  if (stock <= LOW_STOCK_THRESHOLD) {
    return `Quedan ${stock} ${stock === 1 ? "unidad" : "unidades"}`;
  }
  return "Disponible";
}

export function StockLabel({ stock, className }: StockLabelProps) {
  const tone =
    stock <= 0
      ? "font-semibold text-alert"
      : stock <= LOW_STOCK_THRESHOLD
        ? "text-warn"
        : "text-ok";

  return (
    <span className={cn("text-[11.5px] tracking-[.04em]", tone, className)}>
      {stockText(stock)}
    </span>
  );
}
