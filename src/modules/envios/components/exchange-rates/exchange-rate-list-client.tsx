"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { Fab } from "@/components/ui/fab";
import { MetricTile } from "@/components/ui/metric-tile";
import { StatusPill } from "@/components/ui/status-pill";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LineChart, Plus, Search, MoreHorizontal, SquarePen, Trash2,
  Calculator, ToggleLeft, ArrowRightLeft, Pin, BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import {
  createExchangeRateRule, updateExchangeRateRule, toggleExchangeRateRule, deleteExchangeRateRule,
} from "../../actions/exchange-rate-actions";
import type { ExchangeRateRuleInput } from "../../lib/schemas";
import type { ExchangeRateRuleRow } from "../../lib/types";
import { CurrencyChip } from "../shared/currency-chip";
import { RateCalculatorCard } from "./rate-calculator-card";
import { ExchangeRateRuleForm } from "./exchange-rate-rule-form";

type CurrencyOption = { currencyId: number; code: string; symbol: string };

interface Props {
  initialRules: ExchangeRateRuleRow[];
  currencies: CurrencyOption[];
}

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
  const openRules = initialRules.filter((r) => r.maxAmount === null).length;

  const closeDialog = () => {
    setIsCreateOpen(false);
    setToEdit(null);
  };

  const handleSubmit = async (payload: ExchangeRateRuleInput) => {
    const r = toEdit
      ? await updateExchangeRateRule(toEdit.ruleId, payload)
      : await createExchangeRateRule(payload);
    if (r.success) {
      toast.success(toEdit ? "Regla actualizada" : "Regla creada");
      closeDialog();
      router.refresh();
      return { success: true };
    }
    return { success: false, error: r.error };
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
        actions={
          <Button
            variant="brand"
            onClick={() => setIsCreateOpen(true)}
            className="hidden md:inline-flex"
          >
            <Plus className="h-4 w-4" /> Nueva regla
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <MetricTile label="Reglas activas" value={totalActive} icon={LineChart} tone="active" />
        <MetricTile label="Reglas totales" value={initialRules.length} icon={Calculator} tone="track" />
        <MetricTile label="Cubren hasta ∞" value={openRules} icon={Calculator} tone="success" />
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
          <div className="grid gap-3 xl:grid-cols-[1fr_320px]">
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
                        <Pin className="h-3 w-3" />
                        {r.accountsCount} {r.accountsCount === 1 ? "cuenta" : "cuentas"}
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
                      <DropdownMenuItem onClick={() => setToEdit(r)}>
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
                <div className={`flex items-center justify-between gap-3 rounded-md bg-muted/30 px-2.5 py-1.5 border-l-4 ${RANGE_COLORS[r.ruleId % RANGE_COLORS.length]}`}>
                  <span className="font-mono tabular-nums text-xs text-muted-foreground">
                    [{r.minAmount.toLocaleString("es-MX")} – {r.maxAmount === null ? "∞" : r.maxAmount.toLocaleString("es-MX")})
                  </span>
                  <span className="font-mono tabular-nums text-sm font-semibold">
                    {r.rate.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                    <span className="ml-1 text-[10px] text-muted-foreground">{r.quoteCurrencyCode}/{r.baseCurrencyCode}</span>
                  </span>
                </div>
              </div>
            ))}
            </div>
            <div className="xl:sticky xl:top-4 xl:self-start">
              <RateCalculatorCard rules={initialRules} />
            </div>
          </div>
        )}
      </div>

      <ResponsiveFormDialog
        open={isCreateOpen || !!toEdit}
        onOpenChange={(o) => { if (!o) closeDialog(); }}
        a11yTitle={toEdit ? "Editar regla" : "Nueva regla"}
        description="Define el par de monedas y los rangos de monto con su tasa correspondiente."
        desktopMaxWidth="sm:max-w-2xl"
      >
        <ExchangeRateRuleForm
          key={toEdit?.ruleId ?? "new"}
          defaultValues={toEdit ?? undefined}
          currencies={currencies}
          onSubmit={handleSubmit}
          onCancel={closeDialog}
        />
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

      <Fab icon={Plus} label="Nueva regla" onClick={() => setIsCreateOpen(true)} />
    </div>
  );
}
