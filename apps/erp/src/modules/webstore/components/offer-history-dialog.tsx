"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "@/lib/toast";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { History, Loader2 } from "lucide-react";
import { getOfferHistoryAction } from "@/modules/webstore/actions/offer-actions";
import type { OfferHistoryRow } from "@/modules/webstore/queries/offer-queries";

const HISTORY_ACTION_LABELS: Record<string, string> = {
  created: "Creado",
  updated: "Editado",
  activated: "Activado",
  deactivated: "Desactivado",
  deleted: "Eliminado",
};

const HISTORY_ACTION_STATUS: Record<string, "active" | "inactive" | "pending" | "cancelled"> = {
  created: "active",
  updated: "pending",
  activated: "active",
  deactivated: "inactive",
  deleted: "cancelled",
};

interface Props {
  offerId: number | null;
  offerName?: string;
  onOpenChange: (open: boolean) => void;
}

export function OfferHistoryDialog({ offerId, offerName, onOpenChange }: Props) {
  const [history, setHistory] = useState<OfferHistoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadHistory = useCallback(() => {
    if (offerId == null) return;
    setIsLoading(true);
    getOfferHistoryAction(offerId)
      .then((res) => {
        if (res.success) setHistory(res.data);
        else toast.error(res.error);
      })
      .catch(() => toast.error("No se pudo cargar el historial de la oferta."))
      .finally(() => setIsLoading(false));
  }, [offerId]);

  useEffect(() => {
    if (offerId == null) return;
    loadHistory();
  }, [offerId, loadHistory]);

  return (
    <ResponsiveFormDialog
      open={offerId != null}
      onOpenChange={onOpenChange}
      title="Historial de la oferta"
      description={offerName}
      showHeader
    >
      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : history.length > 0 ? (
          history.map((h) => (
            <div
              key={h.historyId}
              className="rounded-lg border border-border bg-muted/20 p-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                <StatusPill
                  status={HISTORY_ACTION_STATUS[h.action] ?? "inactive"}
                  label={HISTORY_ACTION_LABELS[h.action] ?? h.action}
                  size="sm"
                />
                <span className="font-medium text-foreground truncate">
                  {h.productName ?? "Producto eliminado"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {h.changedByName ?? "Sistema"} · {new Date(h.changedAt).toLocaleString("es-MX")}
              </div>
            </div>
          ))
        ) : (
          <EmptyState
            icon={<History className="size-10" />}
            title="Sin historial"
            description="Esta oferta no tiene eventos registrados."
          />
        )}
      </div>
    </ResponsiveFormDialog>
  );
}
