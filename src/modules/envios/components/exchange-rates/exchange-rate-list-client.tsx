"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { Fab } from "@/components/ui/fab";
import { MetricTile } from "@/components/ui/metric-tile";
import { StatusPill } from "@/components/ui/status-pill";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FormDialogHeader } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import {
  LineChart, Plus, Search, MoreHorizontal, SquarePen, Trash2, Loader2,
  Type, Hash, Calculator, ToggleLeft, ArrowRightLeft, Pin, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  createExchangeRateRule, updateExchangeRateRule, toggleExchangeRateRule, deleteExchangeRateRule,
} from "../../actions/exchange-rate-actions";
import type { ExchangeRateRuleRow } from "../../lib/types";
import { CurrencyChip } from "../shared/currency-chip";
import { RateCalculatorCard } from "./rate-calculator-card";

type CurrencyOption = { currencyId: number; code: string; symbol: string };

interface Props {
  initialRules: ExchangeRateRuleRow[];
  currencies: CurrencyOption[];
}

type RangeRow = { minAmount: string; maxAmount: string; rate: string };

const RANGE_COLORS = [
  "border-l-sky-500",
  "border-l-emerald-500",
  "border-l-amber-500",
  "border-l-violet-500",
  "border-l-rose-500",
];

export function ExchangeRateListClient({ initialRules, currencies }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toEdit, setToEdit] = useState<ExchangeRateRuleRow | null>(null);
  const [toDelete, setToDelete] = useState<ExchangeRateRuleRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [kind, setKind] = useState<"fixed" | "range">("range");
  const [baseCurrencyId, setBaseCurrencyId] = useState<string>("");
  const [quoteCurrencyId, setQuoteCurrencyId] = useState<string>("");
  const [ranges, setRanges] = useState<RangeRow[]>([
    { minAmount: "0", maxAmount: "", rate: "" },
  ]);
  const [fixedRate, setFixedRate] = useState<string>("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return initialRules;
    return initialRules.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.baseCurrencyCode.toLowerCase().includes(q) ||
        r.quoteCurrencyCode.toLowerCase().includes(q)
    );
  }, [initialRules, search]);

  const totalActive = initialRules.filter((r) => r.active).length;
  const totalRanges = initialRules.reduce((acc, r) => acc + r.ranges.length, 0);

  const resetForm = () => {
    setName(""); setKind("range"); setBaseCurrencyId(""); setQuoteCurrencyId("");
    setRanges([{ minAmount: "0", maxAmount: "", rate: "" }]);
    setFixedRate("");
  };

  const fillEdit = (r: ExchangeRateRuleRow) => {
    setName(r.name);
    setKind(r.kind);
    setBaseCurrencyId(String(r.baseCurrencyId));
    setQuoteCurrencyId(String(r.quoteCurrencyId));
    if (r.kind === "fixed") {
      setFixedRate(r.ranges[0] ? String(r.ranges[0].rate) : "");
      setRanges([{ minAmount: "0", maxAmount: "", rate: r.ranges[0] ? String(r.ranges[0].rate) : "" }]);
    } else {
      setFixedRate("");
      setRanges(
        r.ranges.length
          ? r.ranges.map((rg) => ({
              minAmount: String(rg.minAmount),
              maxAmount: rg.maxAmount === null ? "" : String(rg.maxAmount),
              rate: String(rg.rate),
            }))
          : [{ minAmount: "0", maxAmount: "", rate: "" }]
      );
    }
    setToEdit(r);
  };

  const switchKind = (next: "fixed" | "range") => {
    if (next === kind) return;
    if (next === "fixed") {
      // Al pasar a fija, conservar la primera tasa de los rangos como punto de partida.
      const firstRate = ranges[0]?.rate || "";
      setFixedRate(firstRate);
    } else {
      // Al pasar a rangos, sembrar el primer rango con la tasa fija si existe.
      setRanges([{ minAmount: "0", maxAmount: "", rate: fixedRate }]);
    }
    setKind(next);
  };

  const updateRange = (i: number, key: keyof RangeRow, val: string) => {
    setRanges((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  };
  const addRange = () => {
    setRanges((prev) => [
      ...prev,
      { minAmount: prev[prev.length - 1]?.maxAmount || "", maxAmount: "", rate: "" },
    ]);
  };
  const removeRange = (i: number) => {
    setRanges((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  };

  // Validación cliente solo aplica a kind=range
  const rangeIssues = useMemo(() => {
    if (kind === "fixed") return [];
    const issues: string[] = [];
    const parsed = ranges.map((r, i) => ({
      i,
      min: Number(r.minAmount),
      max: r.maxAmount === "" ? null : Number(r.maxAmount),
      rate: Number(r.rate),
    }));
    const sorted = [...parsed].sort((a, b) => a.min - b.min);
    for (let i = 0; i < sorted.length; i++) {
      const c = sorted[i], n = sorted[i + 1];
      if (c.min < 0) issues.push(`Rango ${c.i + 1}: mínimo no puede ser negativo`);
      if (c.max != null && c.max <= c.min) issues.push(`Rango ${c.i + 1}: máximo debe ser mayor que mínimo`);
      if (!c.rate || c.rate <= 0) issues.push(`Rango ${c.i + 1}: tasa debe ser mayor a 0`);
      if (n) {
        if (c.max == null) {
          issues.push(`Solo el último rango puede ser abierto (∞)`);
          break;
        }
        if (n.min < c.max) {
          issues.push(`Rango ${c.i + 1} y ${n.i + 1} se solapan`);
        }
      }
    }
    return issues;
  }, [ranges, kind]);

  const validate = () => {
    if (!name.trim()) return "Nombre requerido";
    if (!baseCurrencyId) return "Selecciona moneda base";
    if (!quoteCurrencyId) return "Selecciona moneda destino";
    if (baseCurrencyId === quoteCurrencyId) return "Base y destino deben ser distintas";
    if (kind === "fixed") {
      const r = Number(fixedRate);
      if (!fixedRate || !Number.isFinite(r) || r <= 0) return "Tasa fija debe ser mayor a 0";
      return null;
    }
    if (rangeIssues.length) return rangeIssues[0];
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSubmitting(true);
    const payload = {
      name: name.trim(),
      kind,
      baseCurrencyId: Number(baseCurrencyId),
      quoteCurrencyId: Number(quoteCurrencyId),
      ranges: kind === "fixed"
        ? [{ minAmount: 0, maxAmount: null, rate: Number(fixedRate) }]
        : ranges.map((r) => ({
            minAmount: Number(r.minAmount),
            maxAmount: r.maxAmount === "" ? null : Number(r.maxAmount),
            rate: Number(r.rate),
          })),
    };
    const r = toEdit
      ? await updateExchangeRateRule(toEdit.ruleId, payload)
      : await createExchangeRateRule(payload);
    setSubmitting(false);
    if (r.success) {
      toast.success(toEdit ? "Regla actualizada" : "Regla creada");
      setIsCreateOpen(false); setToEdit(null); resetForm(); router.refresh();
    } else toast.error(r.error);
  };

  const handleToggle = async (r: ExchangeRateRuleRow) => {
    const res = await toggleExchangeRateRule(r.ruleId);
    if (res.success) {
      toast.success(res.data.active ? "Regla activada" : "Regla desactivada");
      router.refresh();
    } else toast.error(res.error);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setSubmitting(true);
    const r = await deleteExchangeRateRule(toDelete.ruleId);
    setSubmitting(false);
    if (r.success) {
      toast.success("Regla eliminada");
      setToDelete(null); router.refresh();
    } else toast.error(r.error);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={LineChart}
        title="Tasas de cambio"
        description="Reglas con rangos por par de monedas. Solapes bloqueados a nivel base de datos."
        badge={`${initialRules.length} reglas`}
      >
        <Button
          variant="brand"
          onClick={() => { resetForm(); setIsCreateOpen(true); }}
          className="hidden md:inline-flex"
        >
          <Plus className="h-4 w-4" /> Nueva regla
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <MetricTile label="Reglas activas" value={totalActive} icon={LineChart} tone="active" />
        <MetricTile label="Rangos totales" value={totalRanges} icon={Calculator} tone="track" />
        <MetricTile
          label="Sin rangos"
          value={initialRules.filter((r) => !r.ranges.length).length}
          icon={Calculator}
          tone="warning"
        />
      </div>

      <div className="space-y-2">
        <InputGroup className="max-w-md">
          <InputGroupAddon><Search /></InputGroupAddon>
          <InputGroupInput
            placeholder="Buscar regla o par…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <InputGroupAddon align="inline-end">
            <Badge variant="brand">{filtered.length}</Badge>
          </InputGroupAddon>
        </InputGroup>

        {filtered.length === 0 ? (
          <EmptyState
            title="Sin reglas"
            description={
              search
                ? "No hay coincidencias."
                : "Crea una regla para que las transferencias calculen la conversión automáticamente."
            }
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
            <div className="grid gap-3 md:grid-cols-2">
            {filtered.map((r) => (
              <div
                key={r.ruleId}
                className="rounded-xl border border-border bg-card p-4 shadow-panel space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-headline text-base font-semibold truncate">{r.name}</span>
                      <StatusPill status={r.active ? "active" : "inactive"} size="sm" />
                      <Badge variant="outline" className="text-[10px] gap-1">
                        {r.kind === "fixed" ? (
                          <><Pin className="h-3 w-3" /> Fija</>
                        ) : (
                          <><BarChart3 className="h-3 w-3" /> Por rangos</>
                        )}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm">
                      <CurrencyChip code={r.baseCurrencyCode} size="sm" />
                      <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
                      <CurrencyChip code={r.quoteCurrencyCode} size="sm" />
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => fillEdit(r)}>
                        <SquarePen className="h-4 w-4" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggle(r)}>
                        <ToggleLeft className="h-4 w-4" /> {r.active ? "Desactivar" : "Activar"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setToDelete(r)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" /> Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="space-y-1.5">
                  {r.ranges.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin rangos configurados.</p>
                  ) : r.kind === "fixed" ? (
                    <div className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 ring-1 ring-inset ring-[var(--ops-active)]/20">
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Pin className="h-3.5 w-3.5" />
                        Cualquier monto
                      </span>
                      <span className="font-mono tabular-nums text-base font-semibold">
                        {r.ranges[0].rate.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                        <span className="ml-1 text-[10px] text-muted-foreground">{r.quoteCurrencyCode}/{r.baseCurrencyCode}</span>
                      </span>
                    </div>
                  ) : (
                    r.ranges.map((rg, idx) => (
                      <div
                        key={rg.rangeId}
                        className={`flex items-center justify-between gap-3 rounded-md bg-muted/30 px-2.5 py-1.5 border-l-4 ${RANGE_COLORS[idx % RANGE_COLORS.length]}`}
                      >
                        <span className="font-mono tabular-nums text-xs text-muted-foreground">
                          {rg.minAmount.toLocaleString("es-MX")} – {rg.maxAmount === null ? "∞" : rg.maxAmount.toLocaleString("es-MX")}
                        </span>
                        <span className="font-mono tabular-nums text-sm font-semibold">
                          {rg.rate.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                          <span className="ml-1 text-[10px] text-muted-foreground">{r.quoteCurrencyCode}/{r.baseCurrencyCode}</span>
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
            </div>
            <div className="lg:sticky lg:top-4 lg:self-start">
              <RateCalculatorCard rules={initialRules} />
            </div>
          </div>
        )}
      </div>

      <ResponsiveFormDialog
        open={isCreateOpen || !!toEdit}
        onOpenChange={(o) => {
          if (!o) {
            setIsCreateOpen(false); setToEdit(null); resetForm();
          }
        }}
        a11yTitle={toEdit ? "Editar regla" : "Nueva regla"}
        description="Define el par de monedas y los rangos de monto con su tasa correspondiente."
        desktopMaxWidth="sm:max-w-2xl"
      >
        <FormDialogHeader
          icon={LineChart}
          title={toEdit ? "Editar regla de tasa" : "Nueva regla de tasa"}
          description="Define el par de monedas y los rangos de monto con su tasa correspondiente."
        />
        <div className="space-y-4 mt-4">
          <FormSection icon={LineChart} title="Identificación">
            <Field label="Nombre" icon={Type} required>
              <Input
                placeholder="USD → CUP estándar"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Moneda base" icon={Hash} required>
                <Select value={baseCurrencyId} onValueChange={setBaseCurrencyId}>
                  <SelectTrigger><SelectValue placeholder="Base" /></SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c.currencyId} value={String(c.currencyId)}>{c.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Moneda destino" icon={Hash} required>
                <Select value={quoteCurrencyId} onValueChange={setQuoteCurrencyId}>
                  <SelectTrigger><SelectValue placeholder="Destino" /></SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c.currencyId} value={String(c.currencyId)}>{c.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FormSection>

          <FormSection icon={Calculator} title="Tipo de tasa">
            <div className="flex items-center gap-1 rounded-lg bg-muted/40 p-1">
              {(
                [
                  { id: "fixed" as const, label: "Tasa fija", icon: Pin, hint: "Un solo valor para cualquier monto" },
                  { id: "range" as const, label: "Por rangos", icon: BarChart3, hint: "Tasa distinta según el monto" },
                ]
              ).map((opt) => {
                const Icon = opt.icon;
                const isActive = kind === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => switchKind(opt.id)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors",
                      isActive
                        ? "bg-background shadow ring-1 ring-border text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {kind === "fixed" ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Una sola tasa que se aplica a cualquier monto convertido por esta regla.
                </p>
                <Field
                  label={baseCurrencyId && quoteCurrencyId
                    ? `Tasa (${currencies.find((c) => String(c.currencyId) === quoteCurrencyId)?.code} por ${currencies.find((c) => String(c.currencyId) === baseCurrencyId)?.code})`
                    : "Tasa"}
                  icon={Pin}
                  required
                >
                  <Input
                    type="number"
                    step="0.00000001"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={fixedRate}
                    onChange={(e) => setFixedRate(e.target.value)}
                  />
                </Field>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Cada rango define una tasa para un intervalo de monto en moneda base.
                  El último rango puede dejarse abierto (∞) para &ldquo;cualquier monto mayor&rdquo;.
                </p>
                <div className="space-y-2">
                  {ranges.map((r, i) => (
                    <div
                      key={i}
                      className={`grid grid-cols-12 gap-2 rounded-md bg-muted/20 p-2 border-l-4 ${RANGE_COLORS[i % RANGE_COLORS.length]}`}
                    >
                      <div className="col-span-4">
                        <label className="text-[10px] font-medium text-muted-foreground">Mínimo</label>
                        <Input
                          type="number"
                          step="0.00000001"
                          value={r.minAmount}
                          onChange={(e) => updateRange(i, "minAmount", e.target.value)}
                        />
                      </div>
                      <div className="col-span-4">
                        <label className="text-[10px] font-medium text-muted-foreground">Máximo (vacío = ∞)</label>
                        <Input
                          type="number"
                          step="0.00000001"
                          value={r.maxAmount}
                          onChange={(e) => updateRange(i, "maxAmount", e.target.value)}
                          placeholder="∞"
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="text-[10px] font-medium text-muted-foreground">Tasa</label>
                        <Input
                          type="number"
                          step="0.00000001"
                          value={r.rate}
                          onChange={(e) => updateRange(i, "rate", e.target.value)}
                        />
                      </div>
                      <div className="col-span-1 flex items-end justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => removeRange(i)}
                          disabled={ranges.length === 1}
                          aria-label="Eliminar rango"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" onClick={addRange} className="w-full">
                  <Plus className="h-4 w-4" /> Añadir rango
                </Button>
                {rangeIssues.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-destructive">
                    {rangeIssues.map((msg, i) => (<li key={i}>• {msg}</li>))}
                  </ul>
                )}
              </>
            )}
          </FormSection>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => { setIsCreateOpen(false); setToEdit(null); resetForm(); }}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="brand"
            onClick={handleSubmit}
            disabled={submitting || rangeIssues.length > 0}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Guardando…" : toEdit ? "Actualizar" : "Crear"}
          </Button>
        </div>
      </ResponsiveFormDialog>

      <AlertDialog open={!!toDelete} onOpenChange={() => setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar regla?</AlertDialogTitle>
            <AlertDialogDescription>
              Si la regla está asignada a alguna cuenta, no podrá eliminarse. Desactívala o reasigna primero.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={submitting}
            >
              {submitting ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Fab icon={Plus} label="Nueva regla" onClick={() => { resetForm(); setIsCreateOpen(true); }} />
    </div>
  );
}
