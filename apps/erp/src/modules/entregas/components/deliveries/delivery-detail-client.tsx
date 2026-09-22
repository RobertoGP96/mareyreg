"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft, HandCoins, CheckCircle2, SquarePen, XCircle, Trash2, BadgeDollarSign, Undo2,
  MoreHorizontal, ExternalLink,
} from "lucide-react";
import { toast } from "@/lib/toast";
import {
  updateCashDelivery,
  cancelCashDelivery,
  deleteCashDelivery,
  markDeliveryCommissionPaid,
  markDeliveryCommissionPending,
} from "../../actions/cash-delivery-actions";
import {
  addDeliveryPhotos,
  removeDeliveryPhoto,
  updateDeliveryPhoto,
} from "../../actions/delivery-photo-actions";
import type { CashDeliveryDetail } from "../../queries/cash-delivery-queries";
import type { RecipientPickerOption } from "../../queries/recipient-queries";
import type { ProviderPickerOption } from "../../queries/provider-queries";
import type { CourierPickerOption } from "../../queries/courier-queries";
import type { ActiveDenomination } from "../../queries/catalog-queries";
import type { CurrencyOption } from "../../lib/types";
import type { CashDeliveryInput } from "../../lib/schemas";
import { CashDeliveryForm } from "./cash-delivery-form";
import { MarkDeliveredDialog } from "./mark-delivered-dialog";
import { DeliveryDetailView, fmtDateTime, hasCommission } from "./delivery-detail-view";
import type { GalleryActions } from "./delivery-photo-gallery";

const STATUS_LABEL: Record<CashDeliveryDetail["status"], string> = {
  pending: "Pendiente",
  delivered: "Entregada",
  cancelled: "Cancelada",
};

interface Props {
  detail: CashDeliveryDetail;
  recipients: RecipientPickerOption[];
  providers: ProviderPickerOption[];
  couriers: CourierPickerOption[];
  currencies: CurrencyOption[];
  denominationsByCurrency: Record<number, ActiveDenomination[]>;
  isAdmin: boolean;
  /** Admin o despachador: pueden editar y eliminar entregas en cualquier estado. */
  canManage: boolean;
  currentUserId: number | null;
}

export function DeliveryDetailClient({
  detail,
  recipients,
  providers,
  couriers,
  currencies,
  denominationsByCurrency,
  isAdmin,
  canManage,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [markingDelivered, setMarkingDelivered] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isPending = detail.status === "pending";
  const commission = hasCommission(detail);

  const runAction = async (
    fn: () => Promise<{ success: boolean; error?: string }>,
    successMessage: string,
    onDone?: () => void
  ): Promise<boolean> => {
    setSubmitting(true);
    try {
      const r = await fn();
      if (r.success) {
        toast.success(successMessage);
        onDone?.();
        router.refresh();
        return true;
      }
      toast.error(r.error ?? "Ocurrió un error");
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (input: CashDeliveryInput): Promise<boolean> => {
    const r = await updateCashDelivery(detail.deliveryId, input);
    if (r.success) {
      toast.success("Entrega actualizada");
      router.refresh();
      return true;
    }
    toast.error(r.error);
    return false;
  };

  const handleDelete = () =>
    runAction(
      () => deleteCashDelivery(detail.deliveryId),
      "Entrega eliminada",
      () => router.push("/entregas")
    );

  const galleryActions: GalleryActions = {
    canAdd: detail.status !== "cancelled",
    canRemove: (p) => isAdmin || (currentUserId != null && p.uploadedById === currentUserId),
    onAdd: async (photos) => {
      const r = await addDeliveryPhotos(detail.deliveryId, photos);
      if (r.success) {
        toast.success(r.data.added === 1 ? "Foto agregada" : `${r.data.added} fotos agregadas`);
        router.refresh();
        return true;
      }
      toast.error(r.error);
      return false;
    },
    onUpdate: async (photoId, meta) => {
      const r = await updateDeliveryPhoto(photoId, meta);
      if (r.success) {
        toast.success("Foto actualizada");
        router.refresh();
        return true;
      }
      toast.error(r.error);
      return false;
    },
    onRemove: async (photoId) => {
      const r = await removeDeliveryPhoto(photoId);
      if (r.success) {
        toast.success("Foto quitada");
        router.refresh();
        return true;
      }
      toast.error(r.error);
      return false;
    },
  };

  const moreMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Más acciones">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {canManage && (
          <DropdownMenuItem onClick={() => setIsFormOpen(true)}>
            <SquarePen className="h-4 w-4" /> Editar
          </DropdownMenuItem>
        )}
        {commission && detail.commissionStatus === "pending" && detail.status !== "cancelled" && (
          <DropdownMenuItem
            onClick={() =>
              runAction(
                () => markDeliveryCommissionPaid(detail.deliveryId),
                "Comisión marcada como pagada"
              )
            }
          >
            <BadgeDollarSign className="h-4 w-4" /> Marcar comisión pagada
          </DropdownMenuItem>
        )}
        {isAdmin && commission && detail.commissionStatus === "paid" && (
          <DropdownMenuItem
            onClick={() =>
              runAction(
                () => markDeliveryCommissionPending(detail.deliveryId),
                "Comisión revertida"
              )
            }
          >
            <Undo2 className="h-4 w-4" /> Revertir comisión
          </DropdownMenuItem>
        )}
        {detail.recipientMapUrl && (
          <DropdownMenuItem
            onClick={() => window.open(detail.recipientMapUrl!, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="h-4 w-4" /> Abrir mapa
          </DropdownMenuItem>
        )}
        {(isPending || canManage) && <DropdownMenuSeparator />}
        {isPending && (
          <DropdownMenuItem
            onClick={() => setConfirmCancel(true)}
            className="text-destructive focus:text-destructive"
          >
            <XCircle className="h-4 w-4" /> Cancelar entrega
          </DropdownMenuItem>
        )}
        {canManage && (
          <DropdownMenuItem
            onClick={() => setConfirmDelete(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" /> Eliminar
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-5">
      <Link
        href="/entregas"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Entregas
      </Link>

      <PageHeader
        icon={HandCoins}
        title={`Entrega #${detail.deliveryId}`}
        description={`${detail.recipientName} · ${fmtDateTime(detail.occurredAt)}`}
        badge={STATUS_LABEL[detail.status]}
        actions={
          <div className="flex items-center gap-2">
            {isPending && (
              <Button variant="brand" onClick={() => setMarkingDelivered(true)} disabled={submitting}>
                <CheckCircle2 className="h-4 w-4" /> Marcar entregada
              </Button>
            )}
            {moreMenu}
          </div>
        }
      />

      <DeliveryDetailView detail={detail} layout="page" galleryActions={galleryActions} />

      <CashDeliveryForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        editing={detail}
        recipients={recipients}
        providers={providers}
        couriers={couriers}
        currencies={currencies}
        denominationsByCurrency={denominationsByCurrency}
        onSubmit={handleEditSubmit}
      />

      <MarkDeliveredDialog
        delivery={markingDelivered ? detail : null}
        onOpenChange={(o) => !o && setMarkingDelivered(false)}
        onConfirmed={() => router.refresh()}
      />

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar entrega?</AlertDialogTitle>
            <AlertDialogDescription>
              Se marcará como cancelada la entrega a {detail.recipientName}.
              {detail.commissionStatus === "paid" &&
                " La comisión ya pagada volverá a quedar pendiente."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                runAction(
                  () => cancelCashDelivery(detail.deliveryId),
                  "Entrega cancelada",
                  () => setConfirmCancel(false)
                )
              }
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={submitting}
            >
              {submitting ? "Cancelando…" : "Cancelar entrega"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar entrega?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente este registro con sus montos, desglose y fotos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={submitting || detail.status === "delivered"}
            >
              {submitting ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
