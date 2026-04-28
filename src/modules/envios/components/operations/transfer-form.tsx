"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Field, FormDialogHeader } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import {
  ArrowRightLeft, Wallet, Hash, FileText, Calendar, Loader2, Calculator, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createTransfer, previewTransferRate } from "../../actions/transfer-actions";
import { CurrencyChip } from "../shared/currency-chip";
import type { OperationFormAccount } from "../../queries/operation-queries";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: OperationFormAccount[];
};

type Preview =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ok"; rate: number; rangeMin: number; rangeMax: number | null; amountTo: number; quoteCode: string }
  | { state: "error"; message: string };

export function TransferForm({ open, onOpenChange, accounts }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [fromId, setFromId] = useState<string>("");
  const [toId, setToId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [statusPending, setStatusPending] = useState(false);
  const [preview, setPreview] = useState<Preview>({ state: "idle" });

  const fromAccount = accounts.find((a) => String(a.accountId) === fromId);
  const toAccount = accounts.find((a) => String(a.accountId) === toId);

  // Cuentas destino candidatas: distintas a origen
  const toCandidates = useMemo(
    () => (fromAccount ? accounts.filter((a) => a.accountId !== fromAccount.accountId) : accounts),
    [accounts, fromAccount]
  );

  const reset = () => {
    setFromId(""); setToId(""); setAmount(""); setDescription("");
    setOccurredAt(""); setStatusPending(false); setPreview({ state: "idle" });
  };

  // Debounce preview de tasa
  useEffect(() => {
    if (!fromId || !toId || !amount || Number(amount) <= 0) {
      setPreview({ state: "idle" });
      return;
    }
    setPreview({ state: "loading" });
    const handle = setTimeout(async () => {
      const r = await previewTransferRate({
        fromAccountId: Number(fromId),
        toAccountId: Number(toId),
        amount: Number(amount),
      });
      if (r.success) {
        setPreview({
          state: "ok",
          rate: r.data.rate,
          rangeMin: r.data.rangeMin,
          rangeMax: r.data.rangeMax,
          amountTo: r.data.amountTo,
          quoteCode: r.data.quoteCurrencyCode,
        });
      } else {
        setPreview({ state: "error", message: r.error });
      }
    }, 220);
    return () => clearTimeout(handle);
  }, [fromId, toId, amount]);

  const validate = () => {
    if (!fromId) return "Selecciona cuenta origen";
    if (!toId) return "Selecciona cuenta destino";
    if (fromId === toId) return "Origen y destino deben ser distintas";
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return "Monto inválido";
    if (preview.state !== "ok") return "Espera a que se calcule la tasa";
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSubmitting(true);
    const r = await createTransfer({
      fromAccountId: Number(fromId),
      toAccountId: Number(toId),
      amount: Number(amount),
      description: description.trim() || null,
      occurredAt: occurredAt ? new Date(occurredAt).toISOString() : null,
      status: statusPending ? "pending" : "confirmed",
    });
    setSubmitting(false);
    if (r.success) {
      toast.success(
        statusPending
          ? `Transferencia pendiente · ${r.data.reference}`
          : `Transferencia confirmada · ${r.data.amountTo.toLocaleString("es-MX", { maximumFractionDigits: 2 })} ${preview.state === "ok" ? preview.quoteCode : ""}`
      );
      onOpenChange(false); reset(); router.refresh();
    } else toast.error(r.error);
  };

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
      a11yTitle="Nueva transferencia"
      description="Movimiento entre cuentas con conversión por tasa de cambio."
      desktopMaxWidth="sm:max-w-2xl"
    >
      <FormDialogHeader
        icon={ArrowRightLeft}
        title="Nueva transferencia"
        description="Selecciona cuentas origen y destino. La tasa se calcula desde la regla asignada."
      />

      <div className="grid md:grid-cols-2 gap-4 mt-4">
        {/* ORIGEN */}
        <FormSection icon={Wallet} title="Origen">
          <Field label="Cuenta origen" icon={Wallet} required>
            <Select value={fromId} onValueChange={(v) => { setFromId(v); setToId(""); }}>
              <SelectTrigger><SelectValue placeholder="Selecciona origen" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.accountId} value={String(a.accountId)}>
                    {a.groupCode}-{a.currencyCode} · {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {fromAccount ? (
            <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 ring-1 ring-inset ring-border text-xs">
              <span className="text-muted-foreground">Saldo</span>
              <span className="font-mono tabular-nums font-semibold">
                {fromAccount.balance.toLocaleString("es-MX", {
                  minimumFractionDigits: fromAccount.currencyDecimals,
                  maximumFractionDigits: fromAccount.currencyDecimals,
                })}
                <span className="ml-1 text-muted-foreground">{fromAccount.currencyCode}</span>
              </span>
            </div>
          ) : null}
          <Field label="Monto a enviar" icon={Hash} required>
            <Input
              type="number"
              step="0.00000001"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
        </FormSection>

        {/* DESTINO */}
        <FormSection icon={ArrowRightLeft} title="Destino">
          <Field label="Cuenta destino" icon={Wallet} required>
            <Select value={toId} onValueChange={setToId} disabled={!fromAccount}>
              <SelectTrigger>
                <SelectValue placeholder={fromAccount ? "Selecciona destino" : "Elige origen primero"} />
              </SelectTrigger>
              <SelectContent>
                {toCandidates.map((a) => (
                  <SelectItem key={a.accountId} value={String(a.accountId)}>
                    {a.groupCode}-{a.currencyCode} · {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="rounded-md bg-muted/30 px-3 py-3 ring-1 ring-inset ring-border space-y-2 min-h-[88px]">
            {preview.state === "idle" && (
              <p className="text-xs text-muted-foreground">Recibirá ≈ se calcula al elegir cuentas y monto.</p>
            )}
            {preview.state === "loading" && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> Calculando tasa…
              </p>
            )}
            {preview.state === "error" && (
              <p className="text-xs text-destructive">⚠ {preview.message}</p>
            )}
            {preview.state === "ok" && (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Recibirá</span>
                  <span className="flex items-center gap-1.5 font-mono tabular-nums text-base font-semibold">
                    {preview.amountTo.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                    <CurrencyChip code={preview.quoteCode} size="sm" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Calculator className="h-3 w-3" />
                    Tasa
                  </span>
                  <span className="font-mono tabular-nums">
                    {preview.rate.toLocaleString("es-MX", { maximumFractionDigits: 6 })}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span>Rango</span>
                  <span className="font-mono tabular-nums">
                    {preview.rangeMin.toLocaleString("es-MX")} – {preview.rangeMax === null ? "∞" : preview.rangeMax.toLocaleString("es-MX")}
                  </span>
                </div>
              </>
            )}
          </div>
        </FormSection>
      </div>

      <div className="space-y-3 mt-3">
        <Field label="Descripción" icon={FileText}>
          <Textarea
            rows={2}
            placeholder="Notas opcionales (visible en ambos movimientos)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Field label="Fecha" icon={Calendar} hint="Por defecto: ahora.">
          <Input
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
          />
        </Field>
        <Field label="Guardar como pendiente" icon={Clock} hint="No mueve saldos hasta confirmarse.">
          <div className="flex items-center gap-3">
            <Switch checked={statusPending} onCheckedChange={setStatusPending} />
            <span className="text-sm text-muted-foreground">{statusPending ? "Sí" : "No"}</span>
          </div>
        </Field>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="brand"
          onClick={handleSubmit}
          disabled={submitting || preview.state !== "ok"}
          className={cn(statusPending && "bg-[var(--ops-warning)] hover:bg-[var(--ops-warning)]/90 text-white")}
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting
            ? "Guardando…"
            : statusPending
              ? "Guardar pendiente"
              : preview.state === "ok"
                ? `Confirmar · ${amount} ${fromAccount?.currencyCode ?? ""} → ${preview.amountTo.toLocaleString("es-MX", { maximumFractionDigits: 2 })} ${preview.quoteCode}`
                : "Confirmar transferencia"}
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}
