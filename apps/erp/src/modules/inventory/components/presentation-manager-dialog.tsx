"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { formatAmount } from "@/lib/format";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Layers,
  Barcode,
  ScanBarcode,
  CircleDollarSign,
  Hash,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  History,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createPresentation,
  updatePresentation,
  setPresentationActive,
  deletePresentation,
  getProductPresentationsAction,
} from "@/modules/inventory/actions/presentation-actions";
import type { ProductPresentationRow } from "@/modules/inventory/queries/presentation-queries";
import type { PriceMarginData } from "@/modules/inventory/lib/margin";
import type { CurrencyOption } from "@/modules/inventory/queries/currency-context";
import { PresentationPriceHistoryDialog } from "./presentation-price-history-dialog";

const BASE_CURRENCY_VALUE = "base";

interface Props {
  productId: number | null;
  productName?: string;
  productUnit?: string;
  currencies?: CurrencyOption[];
  baseCurrencyId?: number;
  baseCode?: string;
  onOpenChange: (open: boolean) => void;
}

export function PresentationManagerDialog({
  productId,
  productName,
  productUnit,
  currencies = [],
  baseCurrencyId,
  baseCode = "CUP",
  onOpenChange,
}: Props) {
  const router = useRouter();
  const [presentations, setPresentations] = useState<ProductPresentationRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ProductPresentationRow | null>(null);
  const [toDelete, setToDelete] = useState<ProductPresentationRow | null>(null);
  const [historyPresentation, setHistoryPresentation] = useState<ProductPresentationRow | null>(null);

  const loadPresentations = useCallback(() => {
    if (productId == null) return;
    setIsLoading(true);
    getProductPresentationsAction(productId)
      .then((res) => {
        if (res.success) setPresentations(res.data);
        else toast.error(res.error);
      })
      .catch(() => toast.error("No se pudieron cargar las presentaciones."))
      .finally(() => setIsLoading(false));
  }, [productId]);

  useEffect(() => {
    if (productId == null) return;
    setShowForm(false);
    setEditing(null);
    loadPresentations();
  }, [productId, loadPresentations]);

  const openEdit = (p: ProductPresentationRow) => {
    setEditing(p);
    setShowForm(true);
  };

  const openCreate = () => {
    setEditing(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  const handleToggle = async (presentationId: number, next: boolean) => {
    const res = await setPresentationActive(presentationId, next);
    if (res.success) {
      toast.success(next ? "Presentación activada" : "Presentación desactivada");
      loadPresentations();
      router.refresh();
    } else {
      toast.error(res.error);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setIsSubmitting(true);
    const res = await deletePresentation(toDelete.presentationId);
    setIsSubmitting(false);
    if (res.success) {
      toast.success("Presentación eliminada");
      setToDelete(null);
      loadPresentations();
      router.refresh();
    } else {
      toast.error(res.error);
    }
  };

  const currencyCode = (currencyId: number | null) =>
    currencyId == null
      ? baseCode
      : currencies.find((c) => c.currencyId === currencyId)?.code ?? `#${currencyId}`;

  const selectableCurrencies = currencies.filter((c) => c.currencyId !== baseCurrencyId);

  const showMarginToast = (margin: PriceMarginData) => {
    if (margin.marginWarning === "negative") {
      toast.warning("Precio por debajo del costo de reposición", {
        description:
          margin.replacementMarginPct != null
            ? `Margen ${margin.replacementMarginPct.toFixed(1)}%`
            : undefined,
      });
    } else if (margin.marginWarning === "low" && margin.replacementMarginPct != null) {
      toast.warning(
        `Margen bajo: ${margin.replacementMarginPct.toFixed(1)}% sobre costo de reposición`
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (productId == null) return;

    const fd = new FormData(e.currentTarget);
    const rawCurrency = fd.get("priceCurrencyId") as string | null;
    const data = {
      name: fd.get("name") as string,
      factor: Number(fd.get("factor")),
      retailPrice: Number(fd.get("retailPrice")),
      wholesalePrice: fd.get("wholesalePrice") ? Number(fd.get("wholesalePrice")) : undefined,
      priceCurrencyId: rawCurrency
        ? rawCurrency === BASE_CURRENCY_VALUE
          ? null
          : Number(rawCurrency)
        : undefined,
      sku: (fd.get("sku") as string) || undefined,
      barcode: (fd.get("barcode") as string) || undefined,
      reason: (fd.get("reason") as string) || undefined,
    };

    setIsSubmitting(true);
    try {
      const res = editing
        ? await updatePresentation(editing.presentationId, data)
        : await createPresentation(productId, data);
      if (res.success) {
        toast.success(editing ? "Presentación actualizada" : "Presentación creada");
        showMarginToast(res.data);
        closeForm();
        loadPresentations();
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <ResponsiveFormDialog
        open={productId != null}
        onOpenChange={onOpenChange}
        title="Presentaciones"
        description={productName}
        showHeader
        desktopMaxWidth="sm:max-w-2xl"
      >
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : presentations.length > 0 ? (
            <div className="space-y-2 max-h-[45vh] overflow-y-auto">
              {presentations.map((p) => (
                <div
                  key={p.presentationId}
                  className={`flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3 text-sm ${!p.isActive ? "opacity-60" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className="font-semibold text-foreground truncate">{p.name}</span>
                      {p.isBase && <Badge variant="brand">Base</Badge>}
                      <StatusPill
                        status={p.isActive ? "active" : "inactive"}
                        label={p.isActive ? "Activa" : "Inactiva"}
                        size="sm"
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      = {p.factor} {productUnit ?? "unidad base"}
                      {p.sku && <> · SKU {p.sku}</>}
                      {p.barcode && <> · {p.barcode}</>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 font-mono tabular-nums text-xs">
                      <span>
                        Menudeo: {formatAmount(p.retailPrice)}
                        {p.priceCurrencyId != null && ` ${currencyCode(p.priceCurrencyId)}`}
                      </span>
                      {p.wholesalePrice != null && (
                        <span>
                          Mayoreo: {formatAmount(p.wholesalePrice)}
                          {p.priceCurrencyId != null && ` ${currencyCode(p.priceCurrencyId)}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Switch
                      checked={p.isActive}
                      disabled={p.isBase}
                      onCheckedChange={(next) => handleToggle(p.presentationId, next)}
                      aria-label={`Alternar presentación ${p.name}`}
                    />
                    <div className="flex items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        title="Historial de precios"
                        onClick={() => setHistoryPresentation(p)}
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        title="Editar"
                        onClick={() => openEdit(p)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {!p.isBase && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          title="Eliminar"
                          onClick={() => setToDelete(p)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Layers className="size-10" />}
              title="Sin presentaciones"
              description="Este producto todavía no tiene presentaciones registradas."
            />
          )}

          {showForm ? (
            <form
              key={editing?.presentationId ?? "create"}
              onSubmit={handleSubmit}
              className="border-t border-border pt-4"
            >
              <FormSection
                icon={Layers}
                title={editing ? "Editar presentación" : "Nueva presentación"}
                description={
                  editing?.isBase
                    ? "El factor de la presentación base no puede modificarse."
                    : "Define el factor respecto a la unidad base y sus precios."
                }
              >
                <Field label="Nombre" icon={Layers} required>
                  <Input
                    name="name"
                    required
                    placeholder="Ej. Caja de 24 latas"
                    defaultValue={editing?.name}
                  />
                </Field>
                <Field
                  label="Factor"
                  icon={Hash}
                  required
                  hint={
                    editing && (editing.isBase || false)
                      ? "La presentación base siempre tiene factor 1."
                      : "Cuántas unidades base equivale una unidad de esta presentación."
                  }
                >
                  <Input
                    name="factor"
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    required
                    disabled={editing?.isBase}
                    defaultValue={editing ? String(editing.factor) : "1"}
                  />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Precio menudeo" icon={CircleDollarSign} required>
                    <Input
                      name="retailPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      defaultValue={editing ? String(editing.retailPrice) : undefined}
                      placeholder="$0.00"
                    />
                  </Field>
                  <Field label="Precio mayoreo" icon={CircleDollarSign} hint="Opcional.">
                    <Input
                      name="wholesalePrice"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={editing?.wholesalePrice != null ? String(editing.wholesalePrice) : ""}
                      placeholder="—"
                    />
                  </Field>
                  <Field label="Moneda" icon={CircleDollarSign} hint="Aplica a ambos precios.">
                    <Select
                      name="priceCurrencyId"
                      defaultValue={
                        editing?.priceCurrencyId != null
                          ? String(editing.priceCurrencyId)
                          : BASE_CURRENCY_VALUE
                      }
                    >
                      <SelectTrigger className="w-full" aria-label="Moneda del precio">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={BASE_CURRENCY_VALUE}>{baseCode}</SelectItem>
                        {selectableCurrencies.map((c) => (
                          <SelectItem key={c.currencyId} value={String(c.currencyId)}>
                            {c.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="SKU" icon={Barcode}>
                    <Input name="sku" defaultValue={editing?.sku ?? ""} placeholder="Opcional" />
                  </Field>
                  <Field label="Código de barras" icon={ScanBarcode}>
                    <Input name="barcode" defaultValue={editing?.barcode ?? ""} placeholder="Opcional" />
                  </Field>
                </div>
                {editing && (
                  <Field label="Motivo del cambio" hint="Opcional. Se guarda en el historial de precios.">
                    <Input name="reason" placeholder="Ej. Ajuste por proveedor" />
                  </Field>
                )}
              </FormSection>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={closeForm}>
                  Cancelar
                </Button>
                <Button type="submit" variant="brand" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSubmitting
                    ? editing
                      ? "Guardando…"
                      : "Creando…"
                    : editing
                      ? "Guardar cambios"
                      : "Crear presentación"}
                </Button>
              </div>
            </form>
          ) : (
            <Button type="button" variant="outline" className="w-full" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Nueva presentación
            </Button>
          )}
        </div>
      </ResponsiveFormDialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar presentación?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. {toDelete?.name} dejará de estar disponible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PresentationPriceHistoryDialog
        presentationId={historyPresentation?.presentationId ?? null}
        presentationName={historyPresentation?.name}
        onOpenChange={(open) => !open && setHistoryPresentation(null)}
      />
    </>
  );
}
