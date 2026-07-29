"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/lib/toast";
import { formatAmount } from "@/lib/format";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  CircleDollarSign,
  FolderTree,
  Loader2,
  Percent,
  ArrowUpCircle,
  ArrowDownCircle,
  Info,
  ChevronLeft,
} from "lucide-react";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import {
  previewBulkPriceAdjustment,
  applyBulkPriceAdjustment,
  getPriceCurrencyOptionsAction,
  type BulkPriceAdjustmentPreviewRow,
} from "@/modules/inventory/actions/pricing-actions";
import type { CurrencyOption } from "@/modules/inventory/queries/currency-context";

type ScopeKind = "all" | "category";
type Mode = "percent" | "fixed" | "rateFactor";
type Direction = "increase" | "decrease";
type Target = "retail" | "wholesale" | "both";
type Rounding = "none" | "cents" | "fifty" | "whole";
/** Filtro de moneda del precio: "all" no filtra, "base" = moneda base (CUP), o el currencyId como string. */
type CurrencyFilter = "all" | "base" | string;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TARGET_LABELS: Record<Target, string> = {
  retail: "Menudeo",
  wholesale: "Mayoreo",
  both: "Ambos",
};

const ROUNDING_LABELS: Record<Rounding, string> = {
  none: "Sin redondeo",
  cents: "Centavos",
  fifty: "50 centavos",
  whole: "Entero",
};

/** Parsea `?reprecio=oldRate:newRate` (ver rate-manager-client.tsx). Ambos valores deben ser números finitos > 0. */
function parseReprecioParam(raw: string | null): { oldRate: number; newRate: number } | null {
  if (!raw) return null;
  const [oldStr, newStr] = raw.split(":");
  const oldRate = Number(oldStr);
  const newRate = Number(newStr);
  if (!Number.isFinite(oldRate) || !Number.isFinite(newRate) || oldRate <= 0 || newRate <= 0) return null;
  return { oldRate, newRate };
}

export function BulkPriceDialog({ open, onOpenChange }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reprecio = useMemo(() => parseReprecioParam(searchParams.get("reprecio")), [searchParams]);

  const [step, setStep] = useState<"config" | "preview">("config");
  const [scopeKind, setScopeKind] = useState<ScopeKind>("all");
  const [category, setCategory] = useState<string>("");
  const [mode, setMode] = useState<Mode>(reprecio ? "rateFactor" : "percent");
  const [direction, setDirection] = useState<Direction>("increase");
  const [value, setValue] = useState<string>("");
  const [rateFactorOld, setRateFactorOld] = useState<string>(reprecio ? String(reprecio.oldRate) : "");
  const [rateFactorNew, setRateFactorNew] = useState<string>(reprecio ? String(reprecio.newRate) : "");
  const [target, setTarget] = useState<Target>("retail");
  const [rounding, setRounding] = useState<Rounding>("cents");
  const [reason, setReason] = useState<string>("");
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilter>(reprecio ? "base" : "all");

  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [previewRows, setPreviewRows] = useState<BulkPriceAdjustmentPreviewRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyOption[]>([]);
  const [baseCurrencyId, setBaseCurrencyId] = useState<number | null>(null);

  // Al abrir, carga las monedas activas para el filtro "moneda del precio".
  // No bloquea el resto del formulario si falla — el filtro simplemente no
  // se aplica y el ajuste corre sobre todo el catálogo (comportamiento previo).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getPriceCurrencyOptionsAction().then((res) => {
      if (cancelled) return;
      if (res.success) {
        setCurrencyOptions(res.data.options);
        setBaseCurrencyId(res.data.baseCurrencyId);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Si el diálogo se abre con `?reprecio=` ya presente, prefill inmediato
  // (cubre el caso donde `open` llega true en el primer render, p. ej. si el
  // caller decide abrirlo leyendo el mismo query param).
  useEffect(() => {
    if (!open || !reprecio) return;
    setMode("rateFactor");
    setRateFactorOld(String(reprecio.oldRate));
    setRateFactorNew(String(reprecio.newRate));
    setCurrencyFilter("base");
  }, [open, reprecio]);

  const resetState = () => {
    setStep("config");
    setScopeKind("all");
    setCategory("");
    setMode("percent");
    setDirection("increase");
    setValue("");
    setRateFactorOld("");
    setRateFactorNew("");
    setTarget("retail");
    setRounding("cents");
    setReason("");
    setCurrencyFilter("all");
    setPreviewRows([]);
    setTotalCount(0);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      resetState();
      // Limpia el query param de deep-link al cerrar para que reabrir el
      // diálogo manualmente no vuelva a prefillar el modo rateFactor.
      if (reprecio) router.replace("/products");
    }
    onOpenChange(next);
  };

  const priceCurrencyId = useMemo((): number | null | undefined => {
    if (currencyFilter === "all") return undefined;
    if (currencyFilter === "base") return null;
    return Number(currencyFilter);
  }, [currencyFilter]);

  const buildInput = () => ({
    scope:
      scopeKind === "all"
        ? ({ kind: "all" } as const)
        : ({ kind: "category" as const, category }),
    mode,
    direction: mode === "rateFactor" ? undefined : direction,
    value: mode === "rateFactor" ? undefined : Number(value),
    rateFactor:
      mode === "rateFactor" ? { oldRate: Number(rateFactorOld), newRate: Number(rateFactorNew) } : undefined,
    target,
    rounding,
    priceCurrencyId,
    reason: reason.trim() || undefined,
  });

  const validationError = useMemo(() => {
    if (scopeKind === "category" && !category) {
      return "Selecciona una categoría";
    }
    if (mode === "rateFactor") {
      const oldRate = Number(rateFactorOld);
      const newRate = Number(rateFactorNew);
      if (!rateFactorOld || !Number.isFinite(oldRate) || oldRate <= 0) {
        return "Ingresa la tasa anterior";
      }
      if (!rateFactorNew || !Number.isFinite(newRate) || newRate <= 0) {
        return "Ingresa la tasa nueva";
      }
      return null;
    }
    const numeric = Number(value);
    if (!value || !Number.isFinite(numeric) || numeric <= 0) {
      return "Ingresa un valor mayor a 0";
    }
    if (mode === "percent" && direction === "decrease" && numeric > 100) {
      return "No se puede disminuir un precio en más del 100%";
    }
    return null;
  }, [scopeKind, category, mode, value, direction, rateFactorOld, rateFactorNew]);

  const handlePreview = async () => {
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setIsLoadingPreview(true);
    try {
      const res = await previewBulkPriceAdjustment(buildInput());
      if (res.success) {
        setPreviewRows(res.data.rows);
        setTotalCount(res.data.totalCount);
        setStep("preview");
      } else {
        toast.error(res.error);
      }
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleApply = async () => {
    setIsApplying(true);
    try {
      const res = await applyBulkPriceAdjustment(buildInput());
      if (res.success) {
        const { affectedCount } = res.data;
        if (affectedCount !== totalCount) {
          toast.warning(
            `Se ajustaron ${affectedCount} presentación(es) (la vista previa mostraba ${totalCount})`,
            {
              description:
                "Hubo cambios concurrentes en el catálogo mientras revisabas la vista previa. Revisa el historial de precios para confirmar el resultado.",
            }
          );
        } else {
          toast.success(`Precios ajustados en ${affectedCount} presentación(es)`);
        }
        router.refresh();
        handleOpenChange(false);
      } else {
        toast.error(res.error);
      }
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Ajustar precios"
      description={
        step === "config"
          ? "Aplica un cambio de precio a varias presentaciones a la vez."
          : "Revisa el cambio antes de aplicarlo."
      }
      showHeader
      desktopMaxWidth="sm:max-w-2xl"
    >
      {step === "config" ? (
        <div className="space-y-6">
          <FormSection icon={FolderTree} title="Alcance" description="A qué productos aplica el ajuste.">
            <RadioGroup
              value={scopeKind}
              onValueChange={(v) => setScopeKind(v as ScopeKind)}
              className="grid-cols-1 sm:grid-cols-2 gap-3"
            >
              <Label
                htmlFor="scope-all"
                className="flex items-center gap-2 rounded-lg border border-border p-3 cursor-pointer has-[[data-state=checked]]:border-[var(--brand)]/50 has-[[data-state=checked]]:bg-[var(--brand)]/5"
              >
                <RadioGroupItem value="all" id="scope-all" />
                Todo el catálogo
              </Label>
              <Label
                htmlFor="scope-category"
                className="flex items-center gap-2 rounded-lg border border-border p-3 cursor-pointer has-[[data-state=checked]]:border-[var(--brand)]/50 has-[[data-state=checked]]:bg-[var(--brand)]/5"
              >
                <RadioGroupItem value="category" id="scope-category" />
                Una categoría
              </Label>
            </RadioGroup>
            {scopeKind === "category" && (
              <Field label="Categoría" required>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </FormSection>

          <FormSection icon={Percent} title="Ajuste" description="Modo, dirección y magnitud del cambio.">
            {reprecio && mode === "rateFactor" && (
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground rounded-lg bg-muted/40 p-2.5">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                Prellenado desde el cambio de tasa reciente en Divisas.
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Modo" required>
                <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Porcentaje</SelectItem>
                    <SelectItem value="fixed">Monto fijo</SelectItem>
                    <SelectItem value="rateFactor">Factor por cambio de tasa</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {mode !== "rateFactor" && (
                <Field label="Valor" required hint={mode === "percent" ? "Porcentaje (0-100)" : "Monto en la moneda base"}>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={mode === "percent" ? "Ej. 10" : "Ej. 5.00"}
                    className="font-mono tabular-nums"
                  />
                </Field>
              )}
            </div>

            {mode === "rateFactor" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Tasa anterior" required>
                  <Input
                    type="number"
                    step="0.00000001"
                    min="0"
                    value={rateFactorOld}
                    onChange={(e) => setRateFactorOld(e.target.value)}
                    placeholder="Ej. 24"
                    className="font-mono tabular-nums"
                  />
                </Field>
                <Field label="Tasa nueva" required>
                  <Input
                    type="number"
                    step="0.00000001"
                    min="0"
                    value={rateFactorNew}
                    onChange={(e) => setRateFactorNew(e.target.value)}
                    placeholder="Ej. 26"
                    className="font-mono tabular-nums"
                  />
                </Field>
              </div>
            ) : (
              <RadioGroup
                value={direction}
                onValueChange={(v) => setDirection(v as Direction)}
                className="grid-cols-1 sm:grid-cols-2 gap-3"
              >
                <Label
                  htmlFor="dir-increase"
                  className="flex items-center gap-2 rounded-lg border border-border p-3 cursor-pointer has-[[data-state=checked]]:border-[var(--success)]/50 has-[[data-state=checked]]:bg-[var(--success)]/5"
                >
                  <RadioGroupItem value="increase" id="dir-increase" />
                  <ArrowUpCircle className="h-4 w-4 text-[var(--success)]" />
                  Subir precio
                </Label>
                <Label
                  htmlFor="dir-decrease"
                  className="flex items-center gap-2 rounded-lg border border-border p-3 cursor-pointer has-[[data-state=checked]]:border-destructive/50 has-[[data-state=checked]]:bg-destructive/5"
                >
                  <RadioGroupItem value="decrease" id="dir-decrease" />
                  <ArrowDownCircle className="h-4 w-4 text-destructive" />
                  Bajar precio
                </Label>
              </RadioGroup>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Objetivo" icon={CircleDollarSign} required>
                <Select value={target} onValueChange={(v) => setTarget(v as Target)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TARGET_LABELS) as Target[]).map((t) => (
                      <SelectItem key={t} value={t}>{TARGET_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Redondeo" required>
                <Select value={rounding} onValueChange={(v) => setRounding(v as Rounding)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROUNDING_LABELS) as Rounding[]).map((r) => (
                      <SelectItem key={r} value={r}>{ROUNDING_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field
              label="Moneda del precio"
              hint="Limita el ajuste a presentaciones cuyo precio está definido en esta moneda."
            >
              <Select value={currencyFilter} onValueChange={(v) => setCurrencyFilter(v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las monedas</SelectItem>
                  {currencyOptions.map((c) => (
                    <SelectItem
                      key={c.currencyId}
                      value={c.currencyId === baseCurrencyId ? "base" : String(c.currencyId)}
                    >
                      {c.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Motivo" hint="Opcional. Se guarda en el historial de precios.">
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej. Ajuste por inflación de proveedor"
                maxLength={200}
              />
            </Field>
          </FormSection>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="brand" onClick={handlePreview} disabled={isLoadingPreview}>
              {isLoadingPreview && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoadingPreview ? "Calculando…" : "Ver vista previa"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            {totalCount} presentación(es) afectada(s)
            {previewRows.length < totalCount && ` · mostrando las primeras ${previewRows.length}`}.
          </p>

          {previewRows.length > 0 ? (
            <div className="max-h-[50vh] overflow-y-auto overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Producto</th>
                    <th className="text-left font-medium px-3 py-2">Presentación</th>
                    <th className="text-right font-medium px-3 py-2">Menudeo</th>
                    <th className="text-right font-medium px-3 py-2">Mayoreo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {previewRows.map((r) => (
                    <tr key={r.presentationId}>
                      <td className="px-3 py-2 truncate max-w-[160px]">{r.productName}</td>
                      <td className="px-3 py-2 text-muted-foreground truncate max-w-[140px]">
                        {r.presentationName}
                        {r.isBase && <span className="ml-1 text-[10px] uppercase text-[var(--brand)]">base</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        <PriceDelta oldValue={r.oldRetail} newValue={r.newRetail} />
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {r.oldWholesale != null && r.newWholesale != null ? (
                          <PriceDelta oldValue={r.oldWholesale} newValue={r.newWholesale} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="Sin presentaciones afectadas"
              description="Ninguna presentación activa coincide con el alcance seleccionado."
            />
          )}

          <div className="flex justify-between gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setStep("config")}>
              <ChevronLeft className="h-4 w-4" />
              Volver
            </Button>
            <Button
              type="button"
              variant="brand"
              onClick={handleApply}
              disabled={isApplying || totalCount === 0}
            >
              {isApplying && <Loader2 className="h-4 w-4 animate-spin" />}
              {isApplying ? "Aplicando…" : "Confirmar"}
            </Button>
          </div>
        </div>
      )}
    </ResponsiveFormDialog>
  );
}

function PriceDelta({ oldValue, newValue }: { oldValue: number; newValue: number }) {
  const diff = newValue - oldValue;
  const colorClass =
    diff > 0 ? "text-[var(--success)]" : diff < 0 ? "text-destructive" : "text-muted-foreground";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-muted-foreground">{formatAmount(oldValue)}</span>
      <span className="text-muted-foreground">{"→"}</span>
      <span className={colorClass}>{formatAmount(newValue)}</span>
    </span>
  );
}
