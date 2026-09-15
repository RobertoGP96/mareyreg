"use client";

import { useId } from "react";
import type { WebstoreProduct } from "@/lib/erp-client";
import { hasStock } from "@/lib/model-groups";
import { ChoiceChips } from "@/components/ui/choice-chips";

interface ModelSelectorProps {
  models: WebstoreProduct[];
  selectedSku: string;
  onSelect: (sku: string) => void;
  /** Etiqueta del eje ("Talla", "Color"). */
  optionLabel: string;
  className?: string;
}

/** Chips de modelo (talla, color…). No se pinta si solo hay un modelo. */
export function ModelSelector({
  models,
  selectedSku,
  onSelect,
  optionLabel,
  className,
}: ModelSelectorProps) {
  const labelId = useId();
  if (models.length <= 1) return null;

  return (
    <div className={className}>
      <p id={labelId} className="eyebrow">
        {optionLabel}
      </p>
      <ChoiceChips
        labelledBy={labelId}
        value={selectedSku}
        onChange={onSelect}
        className="mt-1"
        options={models.map((model) => ({
          value: model.sku,
          label: model.modelGroup?.modelLabel ?? model.name,
          disabled: !hasStock(model),
        }))}
      />
    </div>
  );
}
