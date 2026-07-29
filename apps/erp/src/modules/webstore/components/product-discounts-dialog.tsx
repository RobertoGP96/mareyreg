"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { z } from "zod";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { StatusPill } from "@/components/ui/status-pill";
import { Field } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tag, Percent, Loader2, Plus, Pencil, History, Info } from "lucide-react";
import {
  getProductDiscountsAction,
} from "@/modules/webstore/actions/catalog-actions";
import type { ProductDiscountRow } from "@/modules/webstore/queries/catalog-queries";
import {
  createDiscount,
  updateDiscount,
  toggleDiscount,
  getDiscountHistoryAction,
  type DiscountInput,
} from "@/modules/inventory/actions/discount-actions";
import type { DiscountHistoryRow } from "@/modules/inventory/queries/discount-queries";

const TYPE_LABELS: Record<string, string> = {
  percent: "Porcentaje",
  fixed: "Monto fijo",
  volume: "Por volumen",
};

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

const discountTypeSchema = z.enum(["percent", "fixed", "volume"]);

const toDateInputValue = (value: string | null) => {
  if (!value) return "";
  return value.slice(0, 10);
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

function historyChangeSummary(row: DiscountHistoryRow): string | null {
  if (row.action !== "updated") return null;
  const oldValues = asRecord(row.oldValues);
  const newValues = asRecord(row.newValues);
  if (!oldValues || !newValues) return null;

  const fields: { key: string; label: string }[] = [
    { key: "name", label: "Nombre" },
    { key: "value", label: "Valor" },
    { key: "minQty", label: "Cant. mín" },
  ];

  const changes = fields
    .filter(({ key }) => key in oldValues && key in newValues)
    .map(({ key, label }) => {
      const before = oldValues[key];
      const after = newValues[key];
      if (String(before ?? "—") === String(after ?? "—")) return null;
      return `${label}: ${before ?? "—"} → ${after ?? "—"}`;
    })
    .filter((v): v is string => !!v);

  return changes.length > 0 ? changes.join(" · ") : null;
}

interface Props {
  productId: number | null;
  productName?: string;
  onOpenChange: (open: boolean) => void;
}

export function ProductDiscountsDialog({ productId, productName, onOpenChange }: Props) {
  const router = useRouter();
  const [discounts, setDiscounts] = useState<ProductDiscountRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingVersion, setEditingVersion] = useState<number | null>(null);
  const [history, setHistory] = useState<DiscountHistoryRow[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const loadDiscounts = useCallback(() => {
    if (productId == null) return;
    setIsLoading(true);
    getProductDiscountsAction(productId)
      .then((res) => {
        if (res.success) setDiscounts(res.data);
        else toast.error(res.error);
      })
      .catch(() => toast.error("No se pudieron cargar los descuentos."))
      .finally(() => setIsLoading(false));
  }, [productId]);

  const loadHistory = useCallback(() => {
    if (productId == null) return;
    setIsHistoryLoading(true);
    getDiscountHistoryAction(productId)
      .then((res) => {
        if (res.success) setHistory(res.data);
        else toast.error(res.error);
      })
      .catch(() => toast.error("No se pudo cargar el historial de descuentos."))
      .finally(() => setIsHistoryLoading(false));
  }, [productId]);

  useEffect(() => {
    if (productId == null) return;
    setShowForm(false);
    setEditingId(null);
    setEditingVersion(null);
    setShowHistory(false);
    loadDiscounts();
    loadHistory();
  }, [productId, loadDiscounts, loadHistory]);

  const handleToggle = async (discountId: number, next: boolean) => {
    try {
      const res = await toggleDiscount(discountId, next);
      if (res.success) {
        toast.success(next ? "Descuento activado" : "Descuento desactivado");
        loadDiscounts();
        loadHistory();
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("No se pudo cambiar el estado del descuento.");
    }
  };

  const openEdit = (discount: ProductDiscountRow) => {
    setEditingId(discount.discountId);
    setEditingVersion(discount.version);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setEditingVersion(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (productId == null) return;

    const fd = new FormData(e.currentTarget);
    const parsedType = discountTypeSchema.safeParse(fd.get("type"));
    if (!parsedType.success) {
      toast.error("Tipo de descuento inválido");
      return;
    }

    const data: DiscountInput = {
      name: fd.get("name") as string,
      type: parsedType.data,
      value: Number(fd.get("value")),
      minQty: fd.get("minQty") ? Number(fd.get("minQty")) : undefined,
      startsAt: (fd.get("startsAt") as string) || undefined,
      endsAt: (fd.get("endsAt") as string) || undefined,
      productId,
      ...(editingId != null && editingVersion != null ? { version: editingVersion } : {}),
    };

    setIsSubmitting(true);
    try {
      const res =
        editingId != null ? await updateDiscount(editingId, data) : await createDiscount(data);
      if (res.success) {
        toast.success(editingId != null ? "Descuento actualizado" : "Descuento creado");
        closeForm();
        loadDiscounts();
        loadHistory();
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error(
        editingId != null ? "No se pudo actualizar el descuento." : "No se pudo crear el descuento."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const editingDiscount =
    editingId != null ? discounts.find((d) => d.discountId === editingId) ?? null : null;

  return (
    <ResponsiveFormDialog
      open={productId != null}
      onOpenChange={onOpenChange}
      title="Descuentos del producto"
      description={productName}
      showHeader
    >
      <div className="space-y-4">
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          Solo un descuento puede estar activo a la vez. Al activar uno, los demás se desactivan automáticamente.
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : discounts.length > 0 ? (
          <div className="space-y-2 max-h-[45vh] overflow-y-auto">
            {discounts.map((d) => (
              <div
                key={d.discountId}
                className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className="font-semibold text-foreground truncate">{d.name}</span>
                    <StatusPill
                      status={d.isActive ? "active" : "inactive"}
                      label={d.isActive ? "Activo" : "Inactivo"}
                      size="sm"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {TYPE_LABELS[d.type] ?? d.type} ·{" "}
                    {d.type === "fixed" ? `$${d.value}` : `${d.value}%`}
                    {(d.startsAt || d.endsAt) && (
                      <>
                        {" "}
                        · Vigencia:{" "}
                        {d.startsAt ? new Date(d.startsAt).toLocaleDateString("es-MX") : "—"} a{" "}
                        {d.endsAt ? new Date(d.endsAt).toLocaleDateString("es-MX") : "—"}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Switch
                    checked={d.isActive}
                    onCheckedChange={(next) => handleToggle(d.discountId, next)}
                    aria-label={`Alternar descuento ${d.name}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    title="Editar"
                    onClick={() => openEdit(d)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Tag className="size-10" />}
            title="Sin descuentos"
            description="Este producto no tiene descuentos configurados."
          />
        )}

        {showForm ? (
          <form key={editingId ?? "create"} onSubmit={handleSubmit} className="border-t border-border pt-4">
            <FormSection
              icon={Tag}
              title={editingId != null ? "Editar descuento" : "Nuevo descuento"}
              description="Define una regla de rebaja para este producto."
            >
              <Field label="Nombre" icon={Tag} required>
                <Input
                  name="name"
                  required
                  placeholder="Ej. Liquidación de temporada"
                  defaultValue={editingDiscount?.name}
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Tipo" icon={Percent} required>
                  <Select name="type" defaultValue={editingDiscount?.type ?? "percent"}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Valor" icon={Percent} required hint="Porcentaje (0-100) o monto fijo.">
                  <Input
                    name="value"
                    type="number"
                    step="0.01"
                    required
                    defaultValue={editingDiscount?.value}
                  />
                </Field>
              </div>
              <Field label="Cantidad mínima" hint="Opcional. Requerida para descuentos por volumen.">
                <Input
                  name="minQty"
                  type="number"
                  step="1"
                  placeholder="—"
                  defaultValue={editingDiscount?.minQty ?? undefined}
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Desde">
                  <Input name="startsAt" type="date" defaultValue={toDateInputValue(editingDiscount?.startsAt ?? null)} />
                </Field>
                <Field label="Hasta">
                  <Input name="endsAt" type="date" defaultValue={toDateInputValue(editingDiscount?.endsAt ?? null)} />
                </Field>
              </div>
            </FormSection>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={closeForm}>
                Cancelar
              </Button>
              <Button type="submit" variant="brand" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting
                  ? editingId != null
                    ? "Guardando…"
                    : "Creando…"
                  : editingId != null
                    ? "Guardar cambios"
                    : "Crear descuento"}
              </Button>
            </div>
          </form>
        ) : (
          <Button type="button" variant="outline" className="w-full" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            Nuevo descuento
          </Button>
        )}

        <div className="border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="flex w-full items-center gap-2 text-sm font-medium text-foreground"
          >
            <History className="h-4 w-4 text-muted-foreground" />
            Historial
            <span className="text-xs font-normal text-muted-foreground">
              {showHistory ? "(ocultar)" : "(mostrar)"}
            </span>
          </button>

          {showHistory && (
            <div className="mt-3 space-y-2 max-h-[40vh] overflow-y-auto">
              {isHistoryLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : history.length > 0 ? (
                history.map((h) => {
                  const summary = historyChangeSummary(h);
                  return (
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
                          {h.discountName ?? "Descuento eliminado"}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {h.changedByName ?? "Sistema"} ·{" "}
                        {new Date(h.changedAt).toLocaleString("es-MX")}
                      </div>
                      {summary && (
                        <div className="mt-1 text-xs font-mono tabular-nums text-foreground">
                          {summary}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <EmptyState
                  icon={<History className="size-10" />}
                  title="Sin historial"
                  description="Este producto no tiene eventos de descuentos registrados."
                />
              )}
            </div>
          )}
        </div>
      </div>
    </ResponsiveFormDialog>
  );
}

