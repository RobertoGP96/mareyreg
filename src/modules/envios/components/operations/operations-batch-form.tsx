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
  Settings2, ArrowRightLeft, AlertTriangle, RotateCcw,
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
type Direction = "base_to_quote" | "quote_to_base";

type Row = {
  kind: RowKind;
  accountId: string;
  // regular
  type: RegularType;
  amount: string;
  // conversion
  externalCurrencyId: string;
  externalAmount: string;
  rateInput: string;
  convertedInput: string;
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
  rateInput: "",
  convertedInput: "",
  description: "",
});

const REGULAR_OPTIONS: { id: RegularType; label: string; icon: React.ComponentType<{ className?: string }>; tone: string }[] = [
  { id: "deposit",    label: "Depósito",  icon: ArrowDownLeft, tone: "text-[var(--ops-success)]" },
  { id: "withdrawal", label: "Retiro",    icon: ArrowUpRight,  tone: "text-rose-500" },
  { id: "adjustment", label: "Ajuste",    icon: Settings2,     tone: "text-muted-foreground" },
];

type RowMeta = {
  state: "idle" | "loading" | "ok" | "error";
  defaultRate?: number;
  direction?: Direction;
  message?: string;
};

const num = (v: string): number | null => {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const fmt = (n: number, decimals: number) =>
  n.toLocaleString("es-MX", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const computeConverted = (externalAmount: number, rate: number, direction: Direction) =>
  direction === "base_to_quote" ? externalAmount * rate : externalAmount / rate;

const computeRateFromConverted = (externalAmount: number, convertedAmount: number, direction: Direction) => {
  if (direction === "base_to_quote") {
    if (externalAmount === 0) return 0;
    return convertedAmount / externalAmount;
  }
  if (convertedAmount === 0) return 0;
  return externalAmount / convertedAmount;
};

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
  const [meta, setMeta] = useState<Record<number, RowMeta>>({});

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
    setMeta({});
  };

  // Preset cuando se abre
  useEffect(() => {
    if (open && presetAccountId) {
      setRows((prev) => prev.map((r) => ({ ...r, accountId: String(presetAccountId) })));
    }
  }, [open, presetAccountId]);

  // Autoseleccionar moneda externa para conversiones cuando la cuenta tiene
  // exactamente un par de monedas alterno disponible en sus reglas.
  useEffect(() => {
    setRows((prev) => {
      let changed = false;
      const next = prev.map((r) => {
        if (r.kind !== "conversion") return r;
        if (!r.accountId || r.externalCurrencyId) return r;
        const acc = accounts.find((a) => String(a.accountId) === r.accountId);
        if (!acc || acc.rules.length === 0) return r;
        const others = new Set<number>();
        for (const rule of acc.rules) {
          const other =
            rule.baseCurrencyId === acc.currencyId
              ? rule.quoteCurrencyId
              : rule.quoteCurrencyId === acc.currencyId
                ? rule.baseCurrencyId
                : null;
          if (other !== null) others.add(other);
        }
        if (others.size !== 1) return r;
        const [only] = [...others];
        changed = true;
        return { ...r, externalCurrencyId: String(only) };
      });
      return changed ? next : prev;
    });
  }, [rows, accounts]);

  // Helper para obtener dirección de conversión sin server.
  // Busca entre las reglas asignadas a la cuenta una que cubra el par
  // (acc.currencyId, externalCurrencyId) en alguna dirección.
  const directionFor = (row: Row): Direction | null => {
    const acc = accounts.find((a) => String(a.accountId) === row.accountId);
    if (!acc || acc.rules.length === 0 || !row.externalCurrencyId) return null;
    const ext = Number(row.externalCurrencyId);
    const matchBQ = acc.rules.find(
      (rule) => rule.baseCurrencyId === ext && rule.quoteCurrencyId === acc.currencyId,
    );
    if (matchBQ) return "base_to_quote";
    const matchQB = acc.rules.find(
      (rule) => rule.baseCurrencyId === acc.currencyId && rule.quoteCurrencyId === ext,
    );
    if (matchQB) return "quote_to_base";
    return null;
  };

  // Llamar previewDepositConversion para obtener tasa por defecto y poblar inputs
  useEffect(() => {
    const handles: NodeJS.Timeout[] = [];
    rows.forEach((row, i) => {
      if (row.kind !== "conversion") return;
      const ext = num(row.externalAmount);
      if (!row.accountId || !row.externalCurrencyId || !ext || ext <= 0) {
        setMeta((prev) => ({ ...prev, [i]: { state: "idle" } }));
        return;
      }
      setMeta((prev) =>
        prev[i]?.state === "ok" || prev[i]?.state === "loading"
          ? prev
          : { ...prev, [i]: { state: "loading" } }
      );
      const h = setTimeout(async () => {
        const r = await previewDepositConversion({
          accountId: Number(row.accountId),
          externalCurrencyId: Number(row.externalCurrencyId),
          externalAmount: ext,
        });
        if (r.success) {
          setMeta((prev) => ({
            ...prev,
            [i]: {
              state: "ok",
              defaultRate: r.data.rate,
              direction: r.data.direction,
            },
          }));
          // Sembrar rateInput si está vacío; convertedInput se deriva más abajo.
          setRows((prev) =>
            prev.map((rw, idx) => {
              if (idx !== i) return rw;
              if (rw.rateInput) return rw;
              return { ...rw, rateInput: String(r.data.rate) };
            })
          );
        } else {
          setMeta((prev) => ({ ...prev, [i]: { state: "error", message: r.error } }));
        }
      }, 280);
      handles.push(h);
    });
    return () => handles.forEach(clearTimeout);
  }, [rows, accounts]);

  // Mantener rate↔converted coherentes: si uno cambia (o externalAmount), recalcular el otro derivable
  // siempre y cuando sólo uno de ellos esté "vacío" o ambos estén poblados consistentemente.
  // Implementación pragmática: cada onChange explícito recalcula el contrario inmediatamente.

  const updateRow = (i: number, patch: Partial<Row>) => {
    setRows((prev) =>
      prev.map((r, idx) => {
        if (idx !== i) return r;
        const next = { ...r, ...patch };
        if (patch.kind && patch.kind !== r.kind) {
          if (patch.kind === "regular") {
            next.externalCurrencyId = "";
            next.externalAmount = "";
            next.rateInput = "";
            next.convertedInput = "";
          } else {
            next.amount = "";
          }
        }
        if (patch.accountId !== undefined && patch.accountId !== r.accountId) {
          next.externalCurrencyId = "";
          next.rateInput = "";
          next.convertedInput = "";
        }
        return next;
      })
    );
    setErrorRowIndex(null);
  };

  const onExternalAmountChange = (i: number, val: string) => {
    setRows((prev) =>
      prev.map((r, idx) => {
        if (idx !== i) return r;
        const next = { ...r, externalAmount: val };
        const ext = num(val);
        const rate = num(r.rateInput);
        const dir = directionFor(r);
        if (ext != null && rate != null && rate > 0 && dir) {
          const conv = computeConverted(ext, rate, dir);
          next.convertedInput = Number.isFinite(conv) ? String(conv) : "";
        } else if (!val) {
          next.convertedInput = "";
        }
        return next;
      })
    );
    setErrorRowIndex(null);
  };

  const onRateChange = (i: number, val: string) => {
    setRows((prev) =>
      prev.map((r, idx) => {
        if (idx !== i) return r;
        const next = { ...r, rateInput: val };
        const rate = num(val);
        const ext = num(r.externalAmount);
        const dir = directionFor(r);
        if (rate != null && rate > 0 && ext != null && dir) {
          const conv = computeConverted(ext, rate, dir);
          next.convertedInput = Number.isFinite(conv) ? String(conv) : "";
        }
        return next;
      })
    );
    setErrorRowIndex(null);
  };

  const onConvertedChange = (i: number, val: string) => {
    setRows((prev) =>
      prev.map((r, idx) => {
        if (idx !== i) return r;
        const next = { ...r, convertedInput: val };
        const conv = num(val);
        const ext = num(r.externalAmount);
        const dir = directionFor(r);
        if (conv != null && conv > 0 && ext != null && ext > 0 && dir) {
          const rate = computeRateFromConverted(ext, conv, dir);
          next.rateInput = Number.isFinite(rate) ? String(rate) : "";
        }
        return next;
      })
    );
    setErrorRowIndex(null);
  };

  const restoreDefaultRate = (i: number) => {
    const m = meta[i];
    const row = rows[i];
    if (!m?.defaultRate || !row) return;
    const ext = num(row.externalAmount);
    const dir = m.direction;
    setRows((prev) =>
      prev.map((r, idx) => {
        if (idx !== i) return r;
        const next = { ...r, rateInput: String(m.defaultRate) };
        if (ext != null && dir) {
          const conv = computeConverted(ext, m.defaultRate!, dir);
          next.convertedInput = Number.isFinite(conv) ? String(conv) : "";
        }
        return next;
      })
    );
  };

  const addRow = () => setRows((prev) => [...prev, newRow(presetAccountId)]);
  const removeRow = (i: number) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
    setMeta((prev) => {
      const next = { ...prev };
      delete next[i];
      return next;
    });
  };

  // Delta proyectado por fila (en moneda de cuenta)
  const rowDelta = (row: Row, i: number): number | null => {
    if (row.kind === "regular") {
      const n = num(row.amount);
      if (n === null || n === 0) return null;
      if (row.type === "deposit") return Math.abs(n);
      if (row.type === "withdrawal") return -Math.abs(n);
      return n;
    }
    const conv = num(row.convertedInput);
    if (conv != null && conv > 0) return conv;
    // fallback: si rate y external están y manualConvertedInput no, computar
    const ext = num(row.externalAmount);
    const rate = num(row.rateInput);
    const dir = directionFor(row);
    if (ext != null && rate != null && rate > 0 && dir) {
      const c = computeConverted(ext, rate, dir);
      return Number.isFinite(c) ? c : null;
    }
    return null;
  };

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
      const delta = rowDelta(row, i) ?? 0;
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
  }, [rows, accounts]);

  const validate = (): { valid: boolean; index?: number; error?: string } => {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.accountId) return { valid: false, index: i, error: `Fila ${i + 1}: selecciona una cuenta` };
      if (r.kind === "regular") {
        const n = num(r.amount);
        if (n === null || n === 0) return { valid: false, index: i, error: `Fila ${i + 1}: monto inválido` };
        if (r.type !== "adjustment" && n <= 0) {
          return { valid: false, index: i, error: `Fila ${i + 1}: el monto debe ser positivo` };
        }
      } else {
        if (!r.externalCurrencyId) return { valid: false, index: i, error: `Fila ${i + 1}: selecciona moneda externa` };
        const ext = num(r.externalAmount);
        if (ext === null || ext <= 0) return { valid: false, index: i, error: `Fila ${i + 1}: monto externo inválido` };
        const rate = num(r.rateInput);
        if (rate === null || rate <= 0) return { valid: false, index: i, error: `Fila ${i + 1}: tasa inválida` };
        const m = meta[i];
        if (m?.state === "error") return { valid: false, index: i, error: `Fila ${i + 1}: ${m.message}` };
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
    const payload: BatchRowInput[] = rows.map((row, i) => {
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
      const userRate = Number(row.rateInput);
      const defaultRate = meta[i]?.defaultRate;
      const overrode = defaultRate != null && Math.abs(userRate - defaultRate) > 1e-10;
      return {
        kind: "conversion",
        accountId: Number(row.accountId),
        externalAmount: Number(row.externalAmount),
        externalCurrencyId: Number(row.externalCurrencyId),
        description: row.description.trim() || null,
        status: statusPending ? "pending" : "confirmed",
        rateOverride: overrode ? userRate : null,
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

  const counterCurrencyForAccount = (
    accountId: string,
  ): { currencyId: number; code: string } | null => {
    const acc = accounts.find((a) => String(a.accountId) === accountId);
    if (!acc || acc.rules.length === 0) return null;
    const others = new Set<number>();
    for (const rule of acc.rules) {
      if (rule.baseCurrencyId === acc.currencyId) others.add(rule.quoteCurrencyId);
      else if (rule.quoteCurrencyId === acc.currencyId) others.add(rule.baseCurrencyId);
    }
    if (others.size !== 1) return null;
    const [only] = [...others];
    const c = currencies.find((c) => c.currencyId === only);
    return c ? { currencyId: c.currencyId, code: c.code } : null;
  };

  const isLockedAccount = !!(lockAccount && presetAccountId);

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
        title={isLockedAccount
          ? "Operaciones en lote en esta cuenta"
          : "Operaciones en lote"}
        description="Soporta depósitos, retiros, ajustes y conversiones de moneda. Edita la tasa o el monto convertido para ajustes manuales."
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
                <span className="text-muted-foreground">{fmt(b.initial, b.currencyDecimals)}</span>
                <span
                  className={cn(
                    "text-[10px] font-semibold",
                    b.delta > 0 ? "text-[var(--ops-success)]" : b.delta < 0 ? "text-rose-500" : "text-muted-foreground"
                  )}
                >
                  {b.delta > 0 ? "+" : b.delta < 0 ? "−" : ""}
                  {fmt(Math.abs(b.delta), b.currencyDecimals)}
                </span>
                <span className="text-muted-foreground">→</span>
                <span className={cn("font-semibold", b.final < 0 && "text-rose-500")}>
                  {fmt(b.final, b.currencyDecimals)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3 mt-4">
        <div className="space-y-2">
          {rows.map((row, i) => {
            const acc = accounts.find((a) => String(a.accountId) === row.accountId);
            const counter = row.kind === "conversion" ? counterCurrencyForAccount(row.accountId) : null;
            const m = meta[i];
            const isError = errorRowIndex === i;
            const userRate = num(row.rateInput);
            const isOverride =
              row.kind === "conversion" &&
              m?.defaultRate != null &&
              userRate != null &&
              Math.abs(userRate - m.defaultRate) > 1e-10;

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

                {/* Selector de cuenta solo si NO está locked */}
                {!isLockedAccount && (
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground">Cuenta</label>
                    <Select
                      value={row.accountId}
                      onValueChange={(v) => updateRow(i, { accountId: v })}
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
                )}

                {/* Body por kind */}
                {row.kind === "regular" ? (
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-6 md:col-span-4">
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
                    <div className="col-span-6 md:col-span-3">
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
                    <div className="col-span-11 md:col-span-4">
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
                ) : (
                  <>
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-12 md:col-span-3">
                        <label className="text-[10px] font-medium text-muted-foreground">
                          Monto entrante {counter ? `(${counter.code})` : ""}
                        </label>
                        <Input
                          type="number"
                          step="0.00000001"
                          inputMode="decimal"
                          placeholder="0.00"
                          className="text-right font-mono tabular-nums"
                          value={row.externalAmount}
                          onChange={(e) => onExternalAmountChange(i, e.target.value)}
                          disabled={!counter}
                        />
                      </div>
                      <div className="col-span-6 md:col-span-3">
                        <label className="text-[10px] font-medium text-muted-foreground flex items-center justify-between">
                          <span>
                            Tasa {counter && acc ? `(${acc.currencyCode}/${counter.code})` : ""}
                          </span>
                          {isOverride && m?.defaultRate != null && (
                            <button
                              type="button"
                              onClick={() => restoreDefaultRate(i)}
                              className="text-[10px] text-[var(--brand)] hover:underline flex items-center gap-0.5"
                              title={`Restaurar tasa de la regla (${m.defaultRate})`}
                            >
                              <RotateCcw className="h-2.5 w-2.5" /> Regla
                            </button>
                          )}
                        </label>
                        <Input
                          type="number"
                          step="0.00000001"
                          inputMode="decimal"
                          placeholder={m?.state === "loading" ? "…" : "0.00"}
                          className={cn(
                            "text-right font-mono tabular-nums",
                            isOverride && "ring-1 ring-amber-400/40"
                          )}
                          value={row.rateInput}
                          onChange={(e) => onRateChange(i, e.target.value)}
                          disabled={!counter}
                        />
                      </div>
                      <div className="col-span-6 md:col-span-3">
                        <label className="text-[10px] font-medium text-muted-foreground">
                          Acreditará {acc ? `(${acc.currencyCode})` : ""}
                        </label>
                        <Input
                          type="number"
                          step="0.00000001"
                          inputMode="decimal"
                          placeholder="0.00"
                          className="text-right font-mono tabular-nums font-semibold"
                          value={row.convertedInput}
                          onChange={(e) => onConvertedChange(i, e.target.value)}
                          disabled={!counter}
                        />
                      </div>
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

                    {/* Estado por fila */}
                    {m && m.state !== "ok" && m.state !== "idle" && (
                      <div className="text-[11px] flex items-center gap-1.5">
                        {m.state === "loading" && (
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Cargando tasa de la regla…
                          </span>
                        )}
                        {m.state === "error" && (
                          <span className="text-destructive flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> {m.message}
                          </span>
                        )}
                      </div>
                    )}
                  </>
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
