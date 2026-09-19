"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { FormDialogHeader } from "@/components/ui/field";
import { Loader2, HandCoins, SquarePen, Maximize2 } from "lucide-react";
import type { CashDeliveryDetail } from "../../queries/cash-delivery-queries";
import { DeliveryDetailView } from "./delivery-detail-view";

interface Props {
  detail: CashDeliveryDetail | null;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (detail: CashDeliveryDetail) => void;
}

/**
 * Vista rápida desde el listado. La galería aquí es de solo lectura: agregar
 * o quitar fotos se hace en la página completa de la entrega.
 */
export function CashDeliveryDetailSheet({ detail, loading, onOpenChange, onEdit }: Props) {
  const open = loading || !!detail;
  const description = "Destinatario, montos, mensajero, cronología y fotos.";

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={onOpenChange}
      a11yTitle="Detalle de la entrega"
      description={description}
      desktopMaxWidth="sm:max-w-lg"
    >
      <FormDialogHeader
        icon={HandCoins}
        title={detail ? `Entrega #${detail.deliveryId}` : "Detalle de la entrega"}
        description={description}
      />

      {loading || !detail ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="mt-4">
          <DeliveryDetailView detail={detail} layout="sheet" />
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
        {detail ? (
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link href={`/entregas/${detail.deliveryId}`}>
              <Maximize2 className="h-4 w-4" /> Página completa
            </Link>
          </Button>
        ) : (
          <span />
        )}
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          {detail && onEdit && detail.status === "pending" && (
            <Button type="button" variant="brand" onClick={() => onEdit(detail)}>
              <SquarePen className="h-4 w-4" /> Editar
            </Button>
          )}
        </div>
      </div>
    </ResponsiveFormDialog>
  );
}
