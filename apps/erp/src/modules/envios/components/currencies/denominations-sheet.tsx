"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { FormDialogHeader } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { Banknote, Loader2, Plus, Power, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  createCurrencyDenomination,
  toggleCurrencyDenominationActive,
  deleteCurrencyDenomination,
} from "../../actions/currency-denomination-actions";
import { getDenominationsForCurrency } from "../../actions/denomination-list-action";
import type { DenominationRow } from "../../queries/currency-denomination-queries";
import type { CurrencyRow } from "../../lib/types";
import { formatAmount } from "../../lib/format";

interface Props {
  currency: CurrencyRow | null;
  onOpenChange: (open: boolean) => void;
}

export function DenominationsSheet({ currency, onOpenChange }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<DenominationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async (currencyId: number) => {
    setLoading(true);
    try {
      const r = await getDenominationsForCurrency(currencyId);
      if (r.success) setRows(r.data);
      else toast.error(r.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currency) void load(currency.currencyId);
    else setRows([]);
    setNewValue("");
  }, [currency]);

  const refresh = async () => {
    if (currency) await load(currency.currencyId);
    router.refresh();
  };

  const handleAdd = async () => {
    if (!currency) return;
    const value = Number(newValue);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("El valor debe ser mayor a 0");
      return;
    }
    setSubmitting(true);
    try {
      const r = await createCurrencyDenomination({
        currencyId: currency.currencyId,
        value,
        label: null,
        sortOrder: 0,
      });
      if (r.success) {
        toast.success("Denominación agregada");
        setNewValue("");
        await refresh();
      } else toast.error(r.error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (row: DenominationRow) => {
    setSubmitting(true);
    try {
      const r = await toggleCurrencyDenominationActive(row.denominationId);
      if (r.success) await refresh();
      else toast.error(r.error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row: DenominationRow) => {
    setSubmitting(true);
    try {
      const r = await deleteCurrencyDenomination(row.denominationId);
      if (r.success) {
        toast.success("Denominación eliminada");
        await refresh();
      } else toast.error(r.error);
    } finally {
      setSubmitting(false);
    }
  };

  const title = currency ? `Denominaciones de ${currency.code}` : "Denominaciones";
  const description =
    "El desglose de billetes es obligatorio al registrar entregas: incluye la unidad mínima para que cualquier monto sea expresable.";

  return (
    <ResponsiveFormDialog
      open={!!currency}
      onOpenChange={onOpenChange}
      a11yTitle={title}
      description={description}
      desktopMaxWidth="sm:max-w-lg"
    >
      <FormDialogHeader icon={Banknote} title={title} description={description} />

      <div className="space-y-4 mt-4">
        <div className="flex items-end gap-2">
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="Valor del billete"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="font-mono tabular-nums"
          />
          <Button type="button" variant="brand" onClick={handleAdd} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Agregar
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="Sin denominaciones"
            description="Agrega los billetes y monedas en circulación de esta divisa."
          />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {rows.map((row) => (
              <li
                key={row.denominationId}
                className={cn(
                  "flex items-center gap-2 px-3 py-2",
                  !row.active && "opacity-60"
                )}
              >
                <span className="flex-1 font-mono tabular-nums font-medium">
                  {formatAmount(Number(row.value), currency?.decimalPlaces ?? 2)}
                </span>
                <StatusPill
                  status={row.active ? "completed" : "cancelled"}
                  size="sm"
                  label={row.active ? "Activa" : "Inactiva"}
                />
                <span className="text-[11px] text-muted-foreground tabular-nums w-16 text-right">
                  {row.usageCount} usos
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  aria-label={row.active ? "Desactivar" : "Activar"}
                  onClick={() => void handleToggle(row)}
                  disabled={submitting}
                >
                  <Power className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-destructive"
                  aria-label="Eliminar"
                  onClick={() => void handleDelete(row)}
                  disabled={submitting || row.usageCount > 0}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-end pt-4 border-t border-border">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cerrar
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}
