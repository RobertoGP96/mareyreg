"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { History, Loader2 } from "lucide-react";
import { formatAmount } from "@/modules/envios/lib/format";
import {
  getProductPriceHistoryAction,
} from "@/modules/inventory/actions/product-actions";
import type { ProductPriceHistoryEntry } from "@/modules/inventory/actions/product-actions";

interface Props {
  productId: number | null;
  productName?: string;
  onOpenChange: (open: boolean) => void;
}

export function ProductPriceHistoryDialog({ productId, productName, onOpenChange }: Props) {
  const [history, setHistory] = useState<ProductPriceHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (productId == null) return;
    let cancelled = false;
    setIsLoading(true);
    getProductPriceHistoryAction(productId)
      .then((res) => {
        if (cancelled) return;
        if (res.success) setHistory(res.data);
        else toast.error(res.error);
      })
      .catch(() => {
        if (!cancelled) toast.error("No se pudo cargar el historial de precios.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  return (
    <ResponsiveFormDialog
      open={productId != null}
      onOpenChange={onOpenChange}
      title="Historial de precios"
      description={productName}
      showHeader
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : history.length > 0 ? (
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {history.map((h) => (
            <div key={h.historyId} className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mb-1.5">
                <span>{new Date(h.changedAt).toLocaleString("es-MX")}</span>
                <span>{h.changedByName ?? "—"}</span>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono tabular-nums text-sm">
                <span>
                  {h.oldSalePrice != null ? formatAmount(h.oldSalePrice) : "—"}
                  {" → "}
                  {h.newSalePrice != null ? formatAmount(h.newSalePrice) : "—"}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<History className="size-10" />}
          title="Sin cambios registrados"
          description="Este producto no tiene historial de precios."
        />
      )}
    </ResponsiveFormDialog>
  );
}
