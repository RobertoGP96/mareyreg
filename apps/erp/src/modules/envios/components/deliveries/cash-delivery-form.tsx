"use client";

import { useEffect, useMemo, useState } from "react";
import { upload } from "@vercel/blob/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { Field, FormDialogHeader } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  HandCoins, CircleDollarSign, FileText, Hash, Loader2, Bike, Camera,
} from "lucide-react";
import { toast } from "@/lib/toast";
import type { CurrencyRow } from "../../lib/types";
import type { RecipientPickerOption } from "../../queries/recipient-queries";
import type { CourierPickerOption } from "../../queries/courier-queries";
import type { ActiveDenomination } from "../../queries/currency-denomination-queries";
import type { CashDeliveryDetail } from "../../queries/cash-delivery-queries";
import type { CashDeliveryInput } from "../../lib/schemas";
import { RecipientPicker } from "./recipient-picker";
import { DeliveryPhotoField } from "./delivery-photo-field";
import { DeliveryLinesEditor, lineAmount, type DeliveryLineDraft } from "./delivery-lines-editor";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: CashDeliveryDetail | null;
  recipients: RecipientPickerOption[];
  couriers: CourierPickerOption[];
  currencies: CurrencyRow[];
  denominationsByCurrency: Record<number, ActiveDenomination[]>;
  onSubmit: (input: CashDeliveryInput) => Promise<boolean>;
}

export function CashDeliveryForm({
  open,
  onOpenChange,
  editing,
  recipients,
  couriers,
  currencies,
  denominationsByCurrency,
  onSubmit,
}: Props) {
  const activeCurrencies = useMemo(() => currencies.filter((c) => c.active), [currencies]);

  const [recipientId, setRecipientId] = useState<number | null>(null);
  const [lines, setLines] = useState<DeliveryLineDraft[]>([]);
  const [courierId, setCourierId] = useState<string>("none");
  const [commissionAmount, setCommissionAmount] = useState("");
  const [commissionCurrencyId, setCommissionCurrencyId] = useState<string>("");
  // Una vez que el usuario toca la comisión, elegir otro mensajero ya no la
  // sobreescribe: pisar lo tecleado sería peor que no pre-llenar.
  const [commissionTouched, setCommissionTouched] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setRecipientId(editing.recipientId);
      setLines(
        editing.lines.map((l) => ({
          currencyId: l.currencyId,
          breakdown: l.denominations.map((d) => ({
            denominationId: d.denominationId,
            quantity: d.quantity,
          })),
          amount: l.denominations.length === 0 ? l.amount : "",
        }))
      );
      setCourierId(editing.courierId ? String(editing.courierId) : "none");
      setCommissionAmount(
        Number(editing.commissionAmount) > 0 ? editing.commissionAmount : ""
      );
      setCommissionCurrencyId(
        editing.commissionCurrencyId ? String(editing.commissionCurrencyId) : ""
      );
      setPhotoUrl(editing.photoUrl);
      setReference(editing.reference ?? "");
      setNotes(editing.notes ?? "");
      setCommissionTouched(true);
    } else {
      setRecipientId(null);
      setLines(
        activeCurrencies[0]
          ? [{ currencyId: activeCurrencies[0].currencyId, breakdown: [], amount: "" }]
          : []
      );
      setCourierId("none");
      setCommissionAmount("");
      setCommissionCurrencyId("");
      setPhotoUrl(null);
      setReference("");
      setNotes("");
      setCommissionTouched(false);
    }
    setPhotoFile(null);
  }, [open, editing, activeCurrencies]);

  const handleCourierChange = (value: string) => {
    setCourierId(value);
    if (commissionTouched || value === "none") return;
    const courier = couriers.find((c) => String(c.courierProfileId) === value);
    if (!courier) return;
    if (courier.defaultCommission != null) setCommissionAmount(courier.defaultCommission);
    if (courier.defaultCommissionCurrencyId != null) {
      setCommissionCurrencyId(String(courier.defaultCommissionCurrencyId));
    }
  };

  const validate = (): string | null => {
    if (!recipientId) return "Selecciona un destinatario";
    if (lines.length === 0) return "Agrega al menos un monto";
    for (const line of lines) {
      const currency = activeCurrencies.find((c) => c.currencyId === line.currencyId);
      const label = currency?.code ?? "la moneda";
      if (currency?.kind !== "digital" && line.breakdown.length === 0) {
        return `Captura el desglose de billetes en ${label}`;
      }
      if (lineAmount(line, currencies, denominationsByCurrency) <= 0) {
        return `El monto en ${label} debe ser mayor a 0`;
      }
    }
    const commission = Number(commissionAmount || 0);
    if (!Number.isFinite(commission) || commission < 0) return "Comisión inválida";
    if (commission > 0 && courierId === "none") {
      return "Selecciona el mensajero al asignar una comisión";
    }
    if (commission > 0 && !commissionCurrencyId) return "Selecciona la moneda de la comisión";
    return null;
  };

  const handleSubmit = async () => {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }
    setSubmitting(true);
    try {
      let uploadedUrl = photoUrl;
      if (photoFile) {
        setUploading(true);
        try {
          const safeName = photoFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const blob = await upload(`deliveries/${Date.now()}-${safeName}`, photoFile, {
            access: "public",
            handleUploadUrl: "/api/deliveries/upload",
          });
          uploadedUrl = blob.url;
        } catch (e) {
          console.error("delivery photo upload:", e);
          toast.error("No se pudo subir la foto");
          return;
        } finally {
          setUploading(false);
        }
      }

      const commission = Number(commissionAmount || 0);
      const ok = await onSubmit({
        recipientId: recipientId!,
        lines: lines.map((l) => {
          const isDigital =
            currencies.find((c) => c.currencyId === l.currencyId)?.kind === "digital";
          return {
            currencyId: l.currencyId,
            // El monto solo viaja en digital; en efectivo el servidor lo deriva
            // del desglose y cualquier valor del cliente se ignoraría.
            amount: isDigital ? Number(l.amount) : null,
            denominations: isDigital ? [] : l.breakdown,
          };
        }),
        courierId: courierId === "none" ? null : Number(courierId),
        commissionAmount: commission,
        commissionCurrencyId:
          commission > 0 && commissionCurrencyId ? Number(commissionCurrencyId) : null,
        photoUrl: uploadedUrl,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
      });
      if (ok) onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const title = editing ? "Editar entrega" : "Nueva entrega de efectivo";
  const description = "Captura los billetes entregados; el monto se calcula solo.";

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={onOpenChange}
      a11yTitle={title}
      description={description}
      desktopMaxWidth="sm:max-w-2xl"
    >
      <FormDialogHeader icon={HandCoins} title={title} description={description} />

      <div className="space-y-4 mt-4">
        <FormSection icon={HandCoins} title="Destinatario">
          <Field label="Destinatario" required>
            <RecipientPicker
              recipients={recipients}
              value={recipientId}
              onChange={(r) => setRecipientId(r ? r.recipientId : null)}
            />
          </Field>
        </FormSection>

        <FormSection icon={CircleDollarSign} title="Montos y desglose">
          <DeliveryLinesEditor
            lines={lines}
            onChange={setLines}
            currencies={currencies}
            denominationsByCurrency={denominationsByCurrency}
          />
        </FormSection>

        <FormSection icon={Bike} title="Mensajero y comisión">
          <Field label="Mensajero" icon={Bike}>
            <Select value={courierId} onValueChange={handleCourierChange}>
              <SelectTrigger>
                <SelectValue placeholder="Sin mensajero" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin mensajero</SelectItem>
                {couriers.map((c) => (
                  <SelectItem key={c.courierProfileId} value={String(c.courierProfileId)}>
                    {c.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Comisión" icon={Hash}>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={commissionAmount}
                onChange={(e) => {
                  setCommissionTouched(true);
                  setCommissionAmount(e.target.value);
                }}
                className="font-mono tabular-nums"
              />
            </Field>
            <Field label="Moneda" icon={CircleDollarSign}>
              <Select
                value={commissionCurrencyId}
                onValueChange={(v) => {
                  setCommissionTouched(true);
                  setCommissionCurrencyId(v);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Moneda" />
                </SelectTrigger>
                <SelectContent>
                  {activeCurrencies.map((c) => (
                    <SelectItem key={c.currencyId} value={String(c.currencyId)}>
                      {c.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </FormSection>

        <FormSection icon={FileText} title="Detalles">
          <Field label="Foto del comprobante" icon={Camera} hint="Opcional. JPG, PNG o WebP, máx. 5 MB.">
            <DeliveryPhotoField
              file={photoFile}
              existingUrl={photoUrl}
              onFileChange={setPhotoFile}
              onRemoveExisting={() => setPhotoUrl(null)}
              disabled={submitting}
            />
          </Field>
          <Field label="Referencia" icon={Hash} hint="Folio, comprobante, ticket…">
            <Input
              placeholder="REF-001"
              value={reference}
              maxLength={80}
              onChange={(e) => setReference(e.target.value)}
            />
          </Field>
          <Field label="Notas" icon={FileText}>
            <Textarea
              placeholder="Información adicional sobre la entrega"
              value={notes}
              rows={2}
              maxLength={500}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </FormSection>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="button" variant="brand" onClick={handleSubmit} disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting
            ? uploading
              ? "Subiendo foto…"
              : "Guardando…"
            : editing
              ? "Actualizar"
              : "Registrar"}
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}
