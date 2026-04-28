"use client";

import { useEffect, useMemo, useState } from "react";
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
  Layers, Plus, Trash2, Loader2, Clock, ArrowDownLeft, ArrowUpRight,
  Settings2, ArrowRightLeft, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  createOperationsBatch,
  previewDepositConversion,
} from "../../actions/operation-actions";
import type { OperationFormAccount } from "../../queries/operation-queries";
import type { BatchRowInput } from "../../lib/schemas";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: OperationFormAccount[];
  currencies: Array<{ currencyId: number; code: string; symbol: string }>;
  /** Cuenta a preseleccionar (no editable cuando se llega desde detalle). */
  presetAccountId?: number;
  /** Si true, todas las filas quedan fijadas a presetAccountId. */
  lockAccount?: boolean;
};

type RowKind = "regular" | "conversion";
type RegularType = "deposit" | "withdrawal" | "adjustment";

type Row = {
  kind: RowKind;
  accountId: string;
  // regular
  type: RegularType;
  amount: string;
  // conversion
  externalCurrencyId: string;
  externalAmount: string;
  // común
  description: string;
};

const newRow = (presetAccountId?: number): Row => ({
  kind: "regular",
  accountId: presetAccountId ? String(presetAccountId) : "",
  type: "deposit",
  amount: "",
  externalCurrencyId: "",
  externalAmount: "",
  description: "",
});

const REGULAR_OPTIONS: { id: RegularType; label: string; icon: React.ComponentType<{ className?: string }>; tone: string }[] = [
  { id: "deposit",    label: "Depósito",  icon: ArrowDownLeft, tone: "text-[var(--ops-success)]" },
  { id: "withdrawal", label: "Retiro",    icon: ArrowUpRight,  tone: "text-rose-500" },
  { id: "adjustment", label: "Ajuste",    icon: Settings2,     tone: "text-muted-foreground" },
];

type RowPreview =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ok"; delta: number; rate?: number; counterCode?: string }
  | { state: "error"; message: string };

export function OperationsBatchForm({
  open,
  onOpenChange,
  accounts,
  currencies,
  presetAccountId,
  lockAccount,
}: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([newRow(presetAccountId)]);
  const [statusPending, setStatusPending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorRowIndex, setErrorRowIndex] = useState<number | null>(null);
  const [previews, setPreviews] = useState<Record<number, RowPreview>>({});

  const eligibleAccounts = useMemo(
    () =>
      lockAccount && presetAccountId
        ? accounts.filter((a) => a.accountId === presetAccountId)
        : accounts,
    [accounts, lockAccount, presetAccountId]
  );

  const reset = () => {
    setRows([newRow(presetAccountId)]);
    setStatusPending(false);
    setErrorRowIndex(null);
    setPreviews({});
  };

  // Cuando cambian props del preset
  useEffect(() => {
    if (open && presetAccountId) {
      setRows((prev) =>
        prev.map((r) => ({ ...r, accountId: String(presetAccountId) }))
      );
    }
  }, [open, presetAccountId]);

  const updateRow = (i: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r, idx) => {
      if (idx !== i) return r;
      const next = { ...r, ...patch };
      // Si cambia kind, resetear los campos del otro modo
      if (patch.kind && patch.kind !== r.kind) {
        if (patch.kind === "regular") {
          next.externalCurrencyId = "";
          next.externalAmount = "";
        } else {
          next.amount = "";
        }
      }
      // Si cambia accountId, resetear externalCurrencyId (depende de la regla)
      if (patch.accountId !== undefined && patch.accountId !== r.accountId) {
        next.externalCurrencyId = "";
      }
      return next;
    }));
    setErrorRowIndex(null);
  };

  const addRow = () => setRows((prev) => [...prev, newRow(presetAccountId)]);
  const removeRow = (i: number) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
    setPreviews((prev) => {
      const next = { ...prev };
      delete next[i];
      // re-indexar
      return next;
    });
  };

  // Calcular delta para fila regular
  const regularDelta = (row: Row): number | null => {
    const n = Number(row.amount);
    if (!Number.isFinite(n) || n === 0) return null;
    if (row.type === "deposit") return Math.abs(n);
    if (row.type === "withdrawal") return -Math.abs(n);
    return n; // adjustment respeta signo
  };

  // Preview por fila: regular es local, conversion llama al server con debounce
  useEffect(() => {
    rows.forEach((row, i) => {
      if (row.kind === "regular") {
        const delta = regularDelta(row);
        setPreviews((prev) => {
          if (delta === null) {
            if (prev[i]?.state === "idle") return prev;
            return { ...prev, [i]: { state: "idle" } };
          }
          const cur = prev[i];
          if (cur?.state === "ok" && cur.delta === delta && cur.rate === undefined) return prev;
          return { ...prev, [i]: { state: "ok", delta } };
        });
      }
    });
  }, [rows]);

  // Conversiones: debounce y llamada al server
  useEffect(() => {
    const handles: NodeJS.Timeout[] = [];
    rows.forEach((row, i) => {
      if (row.kind !== "conversion") return;
      if (!row.accountId || !row.externalCurrencyId || !row.externalAmount) {
        setPreviews((prev) => ({ ...prev, [i]: { state: "idle" } }));
        return;
      }
      const n = Number(row.externalAmount);
      if (!Number.isFinite(n) || n <= 0) {
        setPreviews((prev) => ({ ...prev, [i]: { state: "idle" } }));
        return;
      }
      setPreviews((prev) => ({ ...prev, [i]: { state: "loading" } }));
      const h = setTimeout(async () => {
        const r = await previewDepositConversion({
          accountId: Number(row.accountId),
          externalCurrencyId: Number(row.externalCurrencyId),
          externalAmount: n,
        });
        if (r.success) {
          setPreviews((prev) => ({
            ...prev,
            [i]: {
              state: "ok",
              delta: r.data.amountInAccountCurrency,
              rate: r.data.rate,
              counterCode: r.data.externalCurrencyCode,
            },
          }));
        } else {
          setPreviews((prev) => ({ ...prev, [i]: { state: "error", message: r.error } }));
        }
      }, 300);
      handles.push(h);
    });
    return () => handles.forEach(clearTimeout);
  }, [rows]);

  // Saldos proyectados por cuenta (acumulando deltas en orden)
  const projectedBalances = useMemo(() => {
    const map = new Map<
      number,
      {
        accountId: number;
        name: string;
        currencyCode: string;
        currencyDecimals: number;
        initial: number;
        delta: number;
        final: number;
      }
    >();
    rows.forEach((row, i) => {
      if (!row.accountId) return;
      const acc = accounts.find((a) => String(a.accountId) === row.accountId);
      if (!acc) return;
      const preview = previews[i];
      const delta = preview?.state === "ok" ? preview.delta : 0;
      const prev = map.get(acc.accountId);
      if (prev) {
        prev.delta += delta;
        prev.final = prev.initial + prev.delta;
      } else {
        map.set(acc.accountId, {
          accountId: acc.accountId,
          name: acc.name,
          currencyCode: acc.currencyCode,
          currencyDecimals: acc.currencyDecimals,
          initial: acc.balance,
          delta,
          final: acc.balance + delta,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, accounts, previews]);

  const validate = (): { valid: boolean; index?: number; error?: string } => {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.accountId) return { valid: false, index: i, error: `Fila ${i + 1}: selecciona una cuenta` };
      if (r.kind === "regular") {
        const n = Number(r.amount);
        if (!Number.isFinite(n) || n === 0) return { valid: false, index: i, error: `Fila ${i + 1}: monto inválido` };
        if (r.type !== "adjustment" && n <= 0) {
          return { valid: false, index: i, error: `Fila ${i + 1}: el monto debe ser positivo` };
        }
      } else {
        if (!r.externalCurrencyId) return { valid: false, index: i, error: `Fila ${i + 1}: selecciona moneda externa` };
        const n = Number(r.externalAmount);
        if (!Number.isFinite(n) || n <= 0) return { valid: false, index: i, error: `Fila ${i + 1}: monto externo inválido` };
        const preview = previews[i];
        if (preview?.state === "error") {
          return { valid: false, index: i, error: `Fila ${i + 1}: ${preview.message}` };
        }
        if (preview?.state !== "ok") {
          return { valid: false, index: i, error: `Fila ${i + 1}: espera a que se calcule la tasa` };
        }
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
    const payload: BatchRowInput[] = rows.map((row) => {
      if (row.kind === "regular") {
        return {
          kind: "regular",
          accountId: Number(row.accountId),
          type: row.type,
          amount: Number(row.amount),
          description: row.description.trim() || null,
          status: statusPending ? "pending" : "confirmed",
        };
      }
      return {
        kind: "conversion",
        accountId: Number(row.accountId),
        externalAmount: Number(row.externalAmount),
        externalCurrencyId: Number(row.externalCurrencyId),
        description: row.description.trim() || null,
        status: statusPending ? "pending" : "confirmed",
      };
    });
    const r = await createOperationsBatch(payload);
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

  // Para fila conversion: filtrar monedas externas por la regla de la cuenta
  const counterCurrencyForAccount = (accountId: string): { currencyId: number; code: string } | null => {
    const acc = accounts.find((a) => String(a.accountId) === accountId);
    if (!acc?.rule) return null;
    const counterId =
      acc.rule.baseCurrencyId === acc.currencyId
        ? acc.rule.quoteCurrencyId
        : acc.rule.baseCurrencyId;
    const c = currencies.find((c) => c.currencyId === counterId);
    return c ? { currencyId: c.currencyId, code: c.code } : null;
  };

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}
      a11yTitle="Operaciones en lote"
      description="Registra varias operaciones a la vez. Si una falla, ninguna se persiste."
      desktopMaxWidth="sm:max-w-4xl"
    >
      <FormDialogHeader
        icon={Layers}
        title={lockAccount && presetAccountId
          ? "Operaciones en lote en esta cuenta"
          : "Operaciones en lote"}
        description="Registra varias operaciones a la vez. Soporta depósitos, retiros, ajustes y conversiones de moneda."
      />

      {/* Saldos proyectados */}
      {projectedBalances.length > 0 && (
        <div className="mt-4 rounded-md bg-muted/30 ring-1 ring-inset ring-border p-3 space-y-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Saldo resultante proyectado
          </div>
          {projectedBalances.map((b) => (
            <div
              key={b.accountId}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="truncate">
                <span className="font-medium">{b.name}</span>
                <span className="ml-1 text-muted-foreground">{b.currencyCode}</span>
              </span>
              <div className="flex items-center gap-2 font-mono tabular-nums">
                <span className="text-muted-foreground">
                  {b.initial.toLocaleString("es-MX", {
                    minimumFractionDigits: b.currencyDecimals,
                    maximumFractionDigits: b.currencyDecimals,
                  })}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-semibold",
                    b.delta > 0 ? "text-[var(--ops-success)]" : b.delta < 0 ? "text-rose-500" : "text-muted-foreground"
                  )}
                >
                  {b.delta > 0 ? "+" : b.delta < 0 ? "−" : ""}
                  {Math.abs(b.delta).toLocaleString("es-MX", {
                    minimumFractionDigits: b.currencyDecimals,
                    maximumFractionDigits: b.currencyDecimals,
                  })}
                </span>
                <span className="text-muted-foreground">→</span>
                <span
                  className={cn(
                    "font-semibold",
                    b.final < 0 && "text-rose-500"
                  )}
                >
                  {b.final.toLocaleString("es-MX", {
                    minimumFractionDigits: b.currencyDecimals,
                    maximumFractionDigits: b.currencyDecimals,
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3 mt-4">
        <div className="space-y-2">
          {rows.map((row, i) => {
            const isLockedAccount = lockAccount && !!presetAccountId;
            const acc = accounts.find((a) => String(a.accountId) === row.accountId);
            const counter = row.kind === "conversion" ? counterCurrencyForAccount(row.accountId) : null;
            const preview = previews[i];
            const isError = errorRowIndex === i;
            return (
              <div
                key={i}
                className={cn(
                  "rounded-md bg-muted/20 p-3 ring-1 ring-inset space-y-2",
                  isError ? "ring-destructive/50" : "ring-border"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Fila {i + 1}
                  </span>
                  <div className="flex items-center gap-1 rounded-md bg-background ring-1 ring-inset ring-border p-0.5">
                    {(["regular", "conversion"] as const).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => updateRow(i, { kind: k })}
                        className={cn(
                          "px-2 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1",
                          row.kind === k
                            ? "bg-[var(--brand)] text-white"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {k === "regular" ? (
                          <><Settings2 className="h-3 w-3" /> Operación</>
                        ) : (
                          <><ArrowRightLeft className="h-3 w-3" /> Conversión</>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-12 md:col-span-4">
                    <label className="text-[10px] font-medium text-muted-foreground">Cuenta</label>
                    <Select
                      value={row.accountId}
                      onValueChange={(v) => updateRow(i, { accountId: v })}
                      disabled={isLockedAccount}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Cuenta" />
                      </SelectTrigger>
                      <SelectContent>
                        {eligibleAccounts.map((a) => (
                          <SelectItem key={a.accountId} value={String(a.accountId)}>
                            {a.groupCode}-{a.currencyCode} · {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {row.kind === "regular" ? (
                    <>
                      <div className="col-span-6 md:col-span-3">
                        <label className="text-[10px] font-medium text-muted-foreground">Tipo</label>
                        <Select
                          value={row.type}
                          onValueChange={(v) => updateRow(i, { type: v as RegularType })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {REGULAR_OPTIONS.map((t) => {
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
                        <label className="text-[10px] font-medium text-muted-foreground">
                          Monto {acc ? `(${acc.currencyCode})` : ""}
                        </label>
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
                    </>
                  ) : (
                    <>
                      <div className="col-span-6 md:col-span-3">
                        <label className="text-[10px] font-medium text-muted-foreground">
                          Moneda externa
                        </label>
                        <Select
                          value={row.externalCurrencyId}
                          onValueChange={(v) => updateRow(i, { externalCurrencyId: v })}
                          disabled={!counter}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={counter ? counter.code : "Sin regla"} />
                          </SelectTrigger>
                          <SelectContent>
                            {counter && (
                              <SelectItem value={String(counter.currencyId)}>
                                {counter.code}
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-6 md:col-span-2">
                        <label className="text-[10px] font-medium text-muted-foreground">
                          Monto {counter ? `(${counter.code})` : "externo"}
                        </label>
                        <Input
                          type="number"
                          step="0.00000001"
                          inputMode="decimal"
                          placeholder="0.00"
                          className="text-right font-mono tabular-nums"
                          value={row.externalAmount}
                          onChange={(e) => updateRow(i, { externalAmount: e.target.value })}
                          disabled={!counter}
                        />
                      </div>
                    </>
                  )}

                  <div className="col-span-11 md:col-span-2">
                    <label className="text-[10px] font-medium text-muted-foreground">Descripción</label>
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

                {/* Status de preview / errores por fila */}
                {row.kind === "conversion" && preview && preview.state !== "idle" && (
                  <div className="text-[11px] flex items-center gap-1.5">
                    {preview.state === "loading" && (
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Calculando tasa…
                      </span>
                    )}
                    {preview.state === "error" && (
                      <span className="text-destructive flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> {preview.message}
                      </span>
                    )}
                    {preview.state === "ok" && acc && (
                      <span className="text-muted-foreground">
                        Acreditará{" "}
                        <span className="font-mono tabular-nums font-semibold text-foreground">
                          {preview.delta.toLocaleString("es-MX", {
                            minimumFractionDigits: acc.currencyDecimals,
                            maximumFractionDigits: acc.currencyDecimals,
                          })} {acc.currencyCode}
                        </span>
                        {preview.rate && (
                          <> · tasa <span className="font-mono tabular-nums">{preview.rate.toLocaleString("es-MX", { maximumFractionDigits: 6 })}</span></>
                        )}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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
