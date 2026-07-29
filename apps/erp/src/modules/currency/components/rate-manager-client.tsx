"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { Fab } from "@/components/ui/fab";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowRightLeft, CircleDollarSign, MoreHorizontal, Plus, RefreshCcw, Settings2, Trash2, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { formatAmount } from "@/lib/format";
import { createExchangeRate, updateExchangeRate, deleteExchangeRate } from "../actions/rate-actions";
import { RateForm, type RateFormPayload } from "./rate-form";
import { RateHistoryList } from "./rate-history-list";
import type { ExchangeRateRow, ExchangeRateHistoryRow, CurrencyOption } from "../lib/types";

interface RateChangeNotice {
  oldRate: number;
  newRate: number;
  quoteDecimalPlaces: number;
}

interface RateManagerClientProps {
  rates: ExchangeRateRow[];
  historyByRateId: Record<number, ExchangeRateHistoryRow[]>;
  currencies: CurrencyOption[];
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RateManagerClient({ rates, historyByRateId, currencies }: RateManagerClientProps) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toEdit, setToEdit] = useState<ExchangeRateRow | null>(null);
  const [toDelete, setToDelete] = useState<ExchangeRateRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedRateId, setSelectedRateId] = useState<number | null>(rates[0]?.exchangeRateId ?? null);
  const [rateChangeNotice, setRateChangeNotice] = useState<RateChangeNotice | null>(null);

  const selectedRate = useMemo(
    () => rates.find((r) => r.exchangeRateId === selectedRateId) ?? rates[0] ?? null,
    [rates, selectedRateId]
  );
  const selectedHistory = selectedRate ? historyByRateId[selectedRate.exchangeRateId] ?? [] : [];

  const closeDialog = () => {
    setIsCreateOpen(false);
    setToEdit(null);
  };

  const handleSubmit = async (payload: RateFormPayload) => {
    // Capturado ANTES de cerrar el diálogo: closeDialog() limpia `toEdit`, y
    // es la única referencia que tenemos a la tasa vigente antes del cambio.
    const previousRate = toEdit;

    const result =
      payload.mode === "create"
        ? await createExchangeRate({
            baseCurrencyId: payload.baseCurrencyId,
            quoteCurrencyId: payload.quoteCurrencyId,
            rate: payload.rate,
            note: payload.note,
          })
        : await updateExchangeRate({
            exchangeRateId: payload.exchangeRateId,
            rate: payload.rate,
            expectedVersion: payload.expectedVersion,
            note: payload.note,
          });

    if (result.success) {
      toast.success(payload.mode === "create" ? "Tasa creada" : "Tasa actualizada");
      // Solo mostramos el aviso de reprecio en updates: una tasa recién creada
      // no tiene precios ya calculados con la tasa anterior que revisar.
      if (payload.mode === "update" && previousRate) {
        setRateChangeNotice({
          oldRate: previousRate.rate,
          newRate: payload.rate,
          quoteDecimalPlaces: previousRate.quoteDecimalPlaces,
        });
      }
      closeDialog();
      router.refresh();
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  const handleReviewPrices = () => {
    if (!rateChangeNotice) return;
    router.push(`/products?reprecio=${rateChangeNotice.oldRate}:${rateChangeNotice.newRate}`);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const result = await deleteExchangeRate({ exchangeRateId: toDelete.exchangeRateId });
    setDeleting(false);
    if (result.success) {
      toast.success("Tasa eliminada");
      setToDelete(null);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const headerBadge = selectedRate
    ? `1 ${selectedRate.baseCurrencyCode} = ${formatAmount(selectedRate.rate, selectedRate.quoteDecimalPlaces)} ${selectedRate.quoteCurrencyCode}`
    : undefined;

  if (rates.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader
          icon={CircleDollarSign}
          title="Tasa de cambio"
          description="Tasa global manual usada por inventario, compras, ventas y la tienda para convertir montos entre monedas."
          actions={
            <Button variant="brand" onClick={() => setIsCreateOpen(true)} className="hidden md:inline-flex">
              <Plus className="h-4 w-4" /> Nueva tasa
            </Button>
          }
        />
        <EmptyState
          icon={<CircleDollarSign className="size-10" />}
          title="Sin tasas configuradas"
          description="Crea la primera tasa de cambio para que inventario, compras, ventas y la tienda puedan convertir montos."
        >
          <Button variant="brand" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Nueva tasa
          </Button>
        </EmptyState>
        <ResponsiveFormDialog
          open={isCreateOpen}
          onOpenChange={(o) => { if (!o) closeDialog(); }}
          a11yTitle="Nueva tasa de cambio"
          showHeader={false}
        >
          <RateForm mode="create" currencies={currencies} onSubmit={handleSubmit} onCancel={closeDialog} />
        </ResponsiveFormDialog>
        <Fab icon={Plus} label="Nueva tasa" onClick={() => setIsCreateOpen(true)} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        icon={CircleDollarSign}
        title="Tasa de cambio"
        description="Tasa global manual usada por inventario, compras, ventas y la tienda para convertir montos entre monedas."
        badge={headerBadge}
        actions={
          <Button variant="brand" onClick={() => setIsCreateOpen(true)} className="hidden md:inline-flex">
            <Plus className="h-4 w-4" /> Nueva tasa
          </Button>
        }
      />

      {rateChangeNotice && (
        <div className="rounded-xl border border-[var(--brand)]/30 bg-[var(--brand)]/5 p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <RefreshCcw className="h-4 w-4 shrink-0 mt-0.5 text-[var(--brand)]" />
              <p className="text-sm text-foreground">
                La tasa cambió de{" "}
                <span className="font-mono tabular-nums font-medium">
                  {formatAmount(rateChangeNotice.oldRate, rateChangeNotice.quoteDecimalPlaces)}
                </span>{" "}
                a{" "}
                <span className="font-mono tabular-nums font-medium">
                  {formatAmount(rateChangeNotice.newRate, rateChangeNotice.quoteDecimalPlaces)}
                </span>
                . Los precios definidos en USD se actualizan solos; los precios en CUP pueden requerir ajuste.
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              onClick={() => setRateChangeNotice(null)}
              aria-label="Descartar aviso"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex justify-end">
            <Button variant="brand" size="sm" onClick={handleReviewPrices}>
              Revisar precios en CUP
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {rates.map((r) => {
          const isSelected = selectedRate?.exchangeRateId === r.exchangeRateId;
          return (
            <div
              key={r.exchangeRateId}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedRateId(r.exchangeRateId)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedRateId(r.exchangeRateId);
                }
              }}
              className={
                "rounded-xl border bg-card p-4 shadow-panel space-y-3 transition-colors cursor-pointer outline-none " +
                (isSelected
                  ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/25"
                  : "border-border hover:border-[var(--brand)]/40")
              }
              aria-pressed={isSelected}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{r.baseCurrencyCode}</span>
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                  <span className="font-semibold text-foreground">{r.quoteCurrencyCode}</span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => setToEdit(r)}>
                      <RefreshCcw className="h-4 w-4" /> Actualizar tasa
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

              <div className="font-mono tabular-nums text-2xl sm:text-3xl font-bold text-foreground">
                1 {r.baseCurrencyCode} = {formatAmount(r.rate, r.quoteDecimalPlaces)} {r.quoteCurrencyCode}
              </div>

              <div className="text-xs text-muted-foreground">
                Última actualización {formatDate(r.updatedAt)}
                {r.updatedByName && <> · {r.updatedByName}</>}
              </div>
            </div>
          );
        })}
      </div>

      {selectedRate && (
        <div className="space-y-2">
          <h2 className="font-headline text-base font-semibold text-foreground">
            Historial {selectedRate.baseCurrencyCode} → {selectedRate.quoteCurrencyCode}
          </h2>
          <RateHistoryList history={selectedHistory} decimalPlaces={selectedRate.quoteDecimalPlaces} />
        </div>
      )}

      <div className="flex justify-end">
        <Link
          href="/envios/monedas"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Settings2 className="h-3.5 w-3.5" /> Administrar monedas
        </Link>
      </div>

      <ResponsiveFormDialog
        open={isCreateOpen || !!toEdit}
        onOpenChange={(o) => { if (!o) closeDialog(); }}
        a11yTitle={toEdit ? "Actualizar tasa" : "Nueva tasa"}
        showHeader={false}
      >
        {toEdit ? (
          <RateForm
            key={toEdit.exchangeRateId}
            mode="update"
            existingRate={toEdit}
            currencies={currencies}
            onSubmit={handleSubmit}
            onCancel={closeDialog}
          />
        ) : (
          <RateForm mode="create" currencies={currencies} onSubmit={handleSubmit} onCancel={closeDialog} />
        )}
      </ResponsiveFormDialog>

      <AlertDialog open={!!toDelete} onOpenChange={() => setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tasa?</AlertDialogTitle>
            <AlertDialogDescription>
              Si tiene historial de cambios no podrá eliminarse; consérvala para auditoría.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Fab icon={Plus} label="Nueva tasa" onClick={() => setIsCreateOpen(true)} />
    </div>
  );
}
