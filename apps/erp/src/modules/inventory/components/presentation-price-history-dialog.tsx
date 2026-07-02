"use client";

import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { History, Loader2 } from "lucide-react";
import { formatAmount } from "@/lib/format";
import {
  getPresentationPriceHistoryAction,
  type PresentationPriceHistoryEntry,
} from "@/modules/inventory/actions/presentation-actions";

interface Props {
  presentationId: number | null;
  presentationName?: string;
  onOpenChange: (open: boolean) => void;
}

export function PresentationPriceHistoryDialog({
  presentationId,
  presentationName,
  onOpenChange,
}: Props) {
  const [history, setHistory] = useState<PresentationPriceHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (presentationId == null) return;
    let cancelled = false;
    setIsLoading(true);
    getPresentationPriceHistoryAction(presentationId)
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
  }, [presentationId]);

  return (
    <ResponsiveFormDialog
      open={presentationId != null}
      onOpenChange={onOpenChange}
      title="Historial de precios"
      description={presentationName}
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
                  Menudeo: {h.oldRetailPrice != null ? formatAmount(h.oldRetailPrice) : "—"}
                  {" → "}
                  {h.newRetailPrice != null ? formatAmount(h.newRetailPrice) : "—"}
                </span>
                {(h.oldWholesalePrice != null || h.newWholesalePrice != null) && (
                  <span>
                    Mayoreo: {h.oldWholesalePrice != null ? formatAmount(h.oldWholesalePrice) : "—"}
                    {" → "}
                    {h.newWholesalePrice != null ? formatAmount(h.newWholesalePrice) : "—"}
                  </span>
                )}
              </div>
              {h.reason && (
                <div className="mt-1.5 text-xs text-muted-foreground italic">{h.reason}</div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<History className="size-10" />}
          title="Sin cambios registrados"
          description="Esta presentación no tiene historial de precios."
        />
      )}
    </ResponsiveFormDialog>
  );
}
