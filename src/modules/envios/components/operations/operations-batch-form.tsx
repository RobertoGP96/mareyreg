"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FormDialogHeader } from "@/components/ui/field";
import {
  Layers, Plus, Trash2, Loader2, Clock, ArrowDownLeft, ArrowUpRight, Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createOperationsBatch } from "../../actions/operation-actions";
import type { OperationFormAccount } from "../../queries/operation-queries";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: OperationFormAccount[];
};

type RowKind = "deposit" | "withdrawal" | "adjustment";

type Row = {
  accountId: string;
  type: RowKind;
  amount: string;
  description: string;
};

const newRow = (): Row => ({ accountId: "", type: "deposit", amount: "", description: "" });

const TYPE_OPTIONS: { id: RowKind; label: string; icon: React.ComponentType<{ className?: string }>; tone: string }[] = [
  { id: "deposit",    label: "Depósito",  icon: ArrowDownLeft, tone: "text-[var(--ops-success)]" },
  { id: "withdrawal", label: "Retiro",    icon: ArrowUpRight,  tone: "text-rose-500" },
  { id: "adjustment", label: "Ajuste",    icon: Settings2,     tone: "text-muted-foreground" },
];

export function OperationsBatchForm({ open, onOpenChange, accounts }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [statusPending, setStatusPending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorRowIndex, setErrorRowIndex] = useState<number | null>(null);

  const reset = () => {
    setRows([newRow()]);
    setStatusPending(false);
    setErrorRowIndex(null);
  };

  const updateRow = (i: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    setErrorRowIndex(null);
  };

  const addRow = () => setRows((prev) => [...prev, newRow()]);
  const removeRow = (i: number) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  };

  const validate = (): { valid: boolean; index?: number; error?: string } => {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.accountId) return { valid: false, index: i, error: `Fila ${i + 1}: selecciona una cuenta` };
      const n = Number(r.amount);
      if (!Number.isFinite(n) || n === 0) return { valid: false, index: i, error: `Fila ${i + 1}: monto inválido` };
      if (r.type !== "adjustment" && n <= 0) {
        return { valid: false, index: i, error: `Fila ${i + 1}: el monto debe ser positivo` };
      }
    }
    return { valid: true };
  };

  const handleSubmit = async () => {
    const v = validate();
    if (!v.valid) {
      setErrorRowIndex(v.index ?? null);
      toast.error(v.error ?? "Datos inválidos");
      return;
    }
    setSubmitting(true);
    setErrorRowIndex(null);
    const r = await createOperationsBatch(
      rows.map((row) => ({
        accountId: Number(row.accountId),
        type: row.type,
        amount: Number(row.amount),
        description: row.description.trim() || null,
        status: statusPending ? "pending" : "confirmed",
      }))
    );
    setSubmitting(false);
    if (r.success) {
      toast.success(
        statusPending
          ? `${r.data.created.length} operaciones pendientes registradas`
          : `${r.data.created.length} operaciones confirmadas`
      );
      reset();
      onOpenChange(false);
      router.refresh();
    } else {
      const match = r.error.match(/Fila (\d+):/);
      if (match) setErrorRowIndex(Number(match[1]) - 1);
      toast.error(r.error);
    }
  };

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}
      a11yTitle="Operaciones en lote"
      description="Registra varias operaciones a la vez. Si una falla, ninguna se persiste."
      desktopMaxWidth="sm:max-w-3xl"
    >
      <FormDialogHeader
        icon={Layers}
        title="Operaciones en lote"
        description="Registra varias operaciones a la vez. Si una falla, ninguna se persiste."
      />

      <div className="space-y-3 mt-4">
        <div className="hidden md:grid grid-cols-12 gap-2 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span className="col-span-4">Cuenta</span>
          <span className="col-span-3">Tipo</span>
          <span className="col-span-2 text-right">Monto</span>
          <span className="col-span-2">Descripción</span>
          <span className="col-span-1" />
        </div>

        <div className="space-y-2">
          {rows.map((row, i) => (
            <div
              key={i}
              className={cn(
                "grid grid-cols-12 gap-2 rounded-md bg-muted/20 p-2 ring-1 ring-inset",
                errorRowIndex === i ? "ring-destructive/50" : "ring-border"
              )}
            >
              <div className="col-span-12 md:col-span-4">
                <label className="text-[10px] font-medium text-muted-foreground md:hidden">Cuenta</label>
                <Select
                  value={row.accountId}
                  onValueChange={(v) => updateRow(i, { accountId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.accountId} value={String(a.accountId)}>
                        {a.groupCode}-{a.currencyCode} · {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-6 md:col-span-3">
                <label className="text-[10px] font-medium text-muted-foreground md:hidden">Tipo</label>
                <Select
                  value={row.type}
                  onValueChange={(v) => updateRow(i, { type: v as RowKind })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((t) => {
                      const Icon = t.icon;
                      return (
                        <SelectItem key={t.id} value={t.id}>
                          <span className="flex items-center gap-2">
                            <Icon className={cn("h-3.5 w-3.5", t.tone)} /> {t.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-6 md:col-span-2">
                <label className="text-[10px] font-medium text-muted-foreground md:hidden">Monto</label>
                <Input
                  type="number"
                  step="0.00000001"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="text-right font-mono tabular-nums"
                  value={row.amount}
                  onChange={(e) => updateRow(i, { amount: e.target.value })}
                />
              </div>
              <div className="col-span-11 md:col-span-2">
                <label className="text-[10px] font-medium text-muted-foreground md:hidden">Descripción</label>
                <Input
                  placeholder="Notas"
                  value={row.description}
                  onChange={(e) => updateRow(i, { description: e.target.value })}
                />
              </div>
              <div className="col-span-1 flex items-end justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => removeRow(i)}
                  disabled={rows.length === 1}
                  aria-label="Eliminar fila"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={addRow}
          className="w-full"
          disabled={rows.length >= 50}
        >
          <Plus className="h-4 w-4" /> Agregar fila ({rows.length}/50)
        </Button>

        <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 ring-1 ring-inset ring-border">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Guardar como pendientes
          </span>
          <div className="flex items-center gap-2">
            <Switch checked={statusPending} onCheckedChange={setStatusPending} />
            <span className="text-xs text-muted-foreground">{statusPending ? "Sí" : "No"}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="brand"
          onClick={handleSubmit}
          disabled={submitting}
          className={cn(statusPending && "bg-[var(--ops-warning)] hover:bg-[var(--ops-warning)]/90 text-white")}
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting
            ? "Guardando…"
            : statusPending
              ? `Guardar ${rows.length} pendientes`
              : `Confirmar ${rows.length} operaciones`}
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}
