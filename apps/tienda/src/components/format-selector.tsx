"use client";

import { useId, useMemo } from "react";
import type { WebstoreCurrency, WebstoreProduct } from "@/lib/erp-client";
import { fmt } from "@/lib/format";
import {
  formatAvailable,
  formatPrice,
  sortedPresentations,
} from "@/lib/model-groups";
import { ChoiceChips, type ChoiceChipSize } from "@/components/ui/choice-chips";

interface FormatSelectorProps {
  product: WebstoreProduct;
  /** sku de la presentación elegida. */
  selectedSku: string;
  onSelect: (sku: string) => void;
  currency: WebstoreCurrency;
  size?: ChoiceChipSize;
  className?: string;
}

/** Chips de formato (unidad, caja…) con su precio efectivo. No se pinta si solo hay la base. */
export function FormatSelector({
  product,
  selectedSku,
  onSelect,
  currency,
  size = "md",
  className,
}: FormatSelectorProps) {
  const labelId = useId();
  const presentations = useMemo(() => sortedPresentations(product), [product]);
  if (presentations.length <= 1) return null;

  return (
    <div className={className}>
      <p id={labelId} className="eyebrow">
        Formato
      </p>
      <ChoiceChips
        labelledBy={labelId}
        value={selectedSku}
        onChange={onSelect}
        size={size}
        className="mt-1"
        options={presentations.map((pres) => ({
          value: pres.sku,
          // En catch-weight el precio del formato es estimado (peso nominal).
          label: `${pres.name} · ${product.isCatchWeight ? "≈" : ""}${fmt(
            formatPrice(product, pres),
            currency
          )}`,
          disabled: !formatAvailable(product, pres),
        }))}
      />
    </div>
  );
}
