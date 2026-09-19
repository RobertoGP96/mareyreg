"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { Field, FormDialogHeader } from "@/components/ui/field";
import { CheckCircle2, Camera, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { formatAmount } from "@/lib/format";
import { markCashDeliveryDelivered } from "../../actions/cash-delivery-actions";
import { DeliveryPhotosField } from "./delivery-photos-field";
import { materializePhotoDrafts, type PhotoDraft } from "./photo-draft";

export type MarkDeliveredTarget = {
  deliveryId: number;
  recipientName: string;
  photosCount: number;
  lines: { amount: string; currencyCode: string; currencyDecimals: number }[];
};

interface Props {
  delivery: MarkDeliveredTarget | null;
  onOpenChange: (open: boolean) => void;
  onConfirmed: () => void;
}

/**
 * Confirmación de entrega con evidencia opcional: el comprobante firmado o la
 * foto del lugar se suben aquí mismo y quedan en la galería de la entrega.
 */
export function MarkDeliveredDialog({ delivery, onOpenChange, onConfirmed }: Props) {
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const open = delivery !== null;

  useEffect(() => {
    if (!open) setPhotos([]);
  }, [open]);

  const handleConfirm = async () => {
    if (!delivery) return;
    setSubmitting(true);
    try {
      let uploaded;
      setUploading(true);
      try {
        uploaded = await materializePhotoDrafts(photos);
      } catch (e) {
        console.error("mark delivered photo upload:", e);
        toast.error("No se pudieron subir las fotos");
        return;
      } finally {
        setUploading(false);
      }

      const r = await markCashDeliveryDelivered(delivery.deliveryId, uploaded);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success("Entrega confirmada");
      onConfirmed();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const amounts = delivery?.lines
    .map((l) => `${formatAmount(Number(l.amount), l.currencyDecimals)} ${l.currencyCode}`)
    .join(" + ");

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={onOpenChange}
      a11yTitle="Confirmar entrega"
      description="Marca la entrega como realizada y adjunta evidencia si la tienes."
      desktopMaxWidth="sm:max-w-lg"
    >
      <FormDialogHeader
        icon={CheckCircle2}
        title="Confirmar entrega"
        description="Marca la entrega como realizada y adjunta evidencia si la tienes."
      />

      <div className="mt-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          Confirma que se entregaron{" "}
          <span className="font-mono tabular-nums text-foreground">{amounts}</span> a{" "}
          <span className="font-medium text-foreground">{delivery?.recipientName}</span>. Esta
          acción no se puede deshacer.
        </p>

        <Field
          label="Fotos de la entrega"
          icon={Camera}
          hint="Opcional. Comprobante firmado, identificación o foto del lugar. JPG, PNG o WebP, máx. 5 MB cada una."
        >
          <DeliveryPhotosField
            value={photos}
            onChange={setPhotos}
            disabled={submitting}
            max={Math.max(0, 10 - (delivery?.photosCount ?? 0))}
          />
        </Field>
      </div>

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={submitting}
        >
          Cancelar
        </Button>
        <Button type="button" variant="brand" onClick={handleConfirm} disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? (uploading ? "Subiendo fotos…" : "Confirmando…") : "Confirmar entrega"}
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}
