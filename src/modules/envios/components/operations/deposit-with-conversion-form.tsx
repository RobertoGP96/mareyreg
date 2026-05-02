"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
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
  ArrowDownLeft, ArrowUpRight, Wallet, Hash, FileText, Calendar, Loader2, Calculator, Clock, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  createConversionOperation,
  previewDepositConversion,
} from "../../actions/operation-actions";
import { CurrencyChip } from "../shared/currency-chip";
import type { OperationFormAccount } from "../../queries/operation-queries";
import type { ConversionDirection } from "../../lib/schemas";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: OperationFormAccount[];
  currencies: Array<{ currencyId: number; code: string; symbol: string }>;
  /** Cuenta a preseleccionar (por ejemplo desde el detalle). */
  presetAccountId?: number;
};

type Preview =
  | { state: "idle" }
  | { state: "loading" }
  | {
      state: "ok";
      rate: number;
      rangeMin: number;
      rangeMax: number | null;
      amountInAccountCurrency: number;
      ruleName: string;
      accountCode: string;
      externalCode: string;
    }
  | { state: "error"; message: string };

export function DepositWithConversionForm({
  open,
  onOpenChange,
  accounts,
  currencies,
  presetAccountId,
}: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [direction, setDirection] = useState<ConversionDirection>("credit");
  const [accountId, setAccountId] = useState<string>(
    presetAccountId ? String(presetAccountId) : ""
  );
  const [externalCurrencyId, setExternalCurrencyId] = useState<string>("");
  const [externalAmount, setExternalAmount] = useState("");
  const [description, setDescription] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [statusPending, setStatusPending] = useState(false);
  const [preview, setPreview] = useState<Preview>({ state: "idle" });
  const isCredit = direction === "credit";

  // Cuentas con al menos una regla asignada (requisito para depósito con conversión).
  const eligibleAccounts = useMemo(
    () => accounts.filter((a) => a.rules.length > 0),
    [accounts],
  );

  const account = useMemo(
    () => accounts.find((a) => String(a.accountId) === accountId) ?? null,
    [accounts, accountId],
  );

  // Si todas las reglas asignadas a la cuenta apuntan a la misma moneda externa,
  // autoseleccionarla. Si hay varias monedas externas, dejar que el usuario elija.
  const counterCurrency = useMemo(() => {
    if (!account || account.rules.length === 0) return null;
    const others = new Set<number>();
    for (const r of account.rules) {
      if (r.baseCurrencyId === account.currencyId) others.add(r.quoteCurrencyId);
      else if (r.quoteCurrencyId === account.currencyId) others.add(r.baseCurrencyId);
    }
    if (others.size !== 1) return null;
    const [only] = [...others];
    return currencies.find((c) => c.currencyId === only) ?? null;
  }, [account, currencies]);

  // Si la cuenta cambia, autosetear externalCurrency a la contraparte
  useEffect(() => {
    if (counterCurrency) setExternalCurrencyId(String(counterCurrency.currencyId));
    else setExternalCurrencyId("");
  }, [counterCurrency]);

  const reset = () => {
    setDirection("credit");
    setAccountId(presetAccountId ? String(presetAccountId) : "");
    setExternalCurrencyId("");
    setExternalAmount("");
    setDescription("");
    setOccurredAt("");
    setStatusPending(false);
    setPreview({ state: "idle" });
  };

  const debitInsufficient = useMemo(() => {
    if (isCredit) return null;
    if (preview.state !== "ok" || !account) return null;
    const projected = account.balance - preview.amountInAccountCurrency;
    if (projected >= 0) return null;
    return {
      projected,
      blocking: !account.allowNegativeBalance,
    };
  }, [isCredit, preview, account]);

  // Debounce preview
  useEffect(() => {
    if (!accountId || !externalCurrencyId || !externalAmount || Number(externalAmount) <= 0) {
      setPreview({ state: "idle" });
      return;
    }
    setPreview({ state: "loading" });
    const handle = setTimeout(async () => {
      const r = await previewDepositConversion({
        accountId: Number(accountId),
        externalCurrencyId: Number(externalCurrencyId),
        externalAmount: Number(externalAmount),
      });
      if (r.success) {
        setPreview({
          state: "ok",
          rate: r.data.rate,
          rangeMin: r.data.rangeMin,
          rangeMax: r.data.rangeMax,
          amountInAccountCurrency: r.data.amountInAccountCurrency,
          ruleName: r.data.ruleName,
          accountCode: r.data.accountCurrencyCode,
          externalCode: r.data.externalCurrencyCode,
        });
      } else {
        setPreview({ state: "error", message: r.error });
      }
    }, 220);
    return () => clearTimeout(handle);
  }, [accountId, externalCurrencyId, externalAmount]);

  const validate = () => {
    if (!accountId) return isCredit ? "Selecciona la cuenta destino" : "Selecciona la cuenta de origen";
    if (!externalCurrencyId) return "La cuenta no tiene moneda contraparte definida";
    const n = Number(externalAmount);
    if (!Number.isFinite(n) || n <= 0) return "Monto inválido";
    if (preview.state !== "ok") return "Espera a que se calcule la tasa";
    if (debitInsufficient?.blocking) return "Saldo insuficiente";
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSubmitting(true);
    const r = await createConversionOperation({
      direction,
      accountId: Number(accountId),
      externalCurrencyId: Number(externalCurrencyId),
      externalAmount: Number(externalAmount),
      description: description.trim() || null,
      occurredAt: occurredAt ? new Date(occurredAt).toISOString() : null,
      status: statusPending ? "pending" : "confirmed",
    });
    setSubmitting(false);
    if (r.success) {
      const accountCode = preview.state === "ok" ? preview.accountCode : "";
      const amountFmt = r.data.amountInAccountCurrency.toLocaleString("es-MX", { maximumFractionDigits: 2 });
      toast.success(
        statusPending
          ? `Conversión pendiente registrada (${isCredit ? "crédito" : "débito"})`
          : isCredit
            ? `Acreditados ${amountFmt} ${accountCode}`
            : `Debitados ${amountFmt} ${accountCode}`
      );
      onOpenChange(false);
      reset();
      router.refresh();
    } else toast.error(r.error);
  };

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
      a11yTitle="Conversión"
      description={
        isCredit
          ? "Ingresa un monto en la moneda externa; se acreditará en la cuenta aplicando la regla."
          : "Ingresa un monto en la moneda externa que entregarás; se debitará la cuenta aplicando la regla."
      }
      desktopMaxWidth="sm:max-w-2xl"
    >
      <FormDialogHeader
        icon={isCredit ? ArrowDownLeft : ArrowUpRight}
        title="Conversión"
        description={
          isCredit
            ? "Recibes divisa externa; la cuenta sube en su moneda."
            : "Entregas divisa externa; la cuenta baja en su moneda."
        }
      />

      <div className="mt-4">
        <ButtonGroup className="w-full">
          <Button
            type="button"
            variant={isCredit ? "default" : "outline"}
            onClick={() => setDirection("credit")}
            className="flex-1"
          >
            <ArrowDownLeft className="size-4" /> Crédito
          </Button>
          <Button
            type="button"
            variant={!isCredit ? "default" : "outline"}
            onClick={() => setDirection("debit")}
            className="flex-1"
          >
            <ArrowUpRight className="size-4" /> Débito
          </Button>
        </ButtonGroup>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <FormSection icon={Wallet} title={isCredit ? "Cuenta destino" : "Cuenta origen"}>
          <Field label="Cuenta" icon={Wallet} required>
            <Select
              value={accountId}
              onValueChange={setAccountId}
              disabled={!!presetAccountId}
            >
              <SelectTrigger>
                <SelectValue placeholder={eligibleAccounts.length ? "Selecciona cuenta" : "Sin cuentas con regla"} />
              </SelectTrigger>
              <SelectContent>
                {eligibleAccounts.map((a) => (
                  <SelectItem key={a.accountId} value={String(a.accountId)}>
                    {a.groupCode}-{a.currencyCode} · {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {account && account.rules.length === 0 && (
            <p className="text-xs text-destructive">
              Esta cuenta no tiene reglas asignadas. Asigna al menos una desde la lista o el detalle.
            </p>
          )}
          {account && account.rules.length > 0 && counterCurrency && (
            <div className="rounded-md bg-muted/30 px-3 py-2 ring-1 ring-inset ring-border text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Saldo</span>
                <span className="font-mono tabular-nums font-semibold">
                  {account.balance.toLocaleString("es-MX", {
                    minimumFractionDigits: account.currencyDecimals,
                    maximumFractionDigits: account.currencyDecimals,
                  })}
                  <span className="ml-1 text-muted-foreground">{account.currencyCode}</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Contraparte</span>
                <span className="flex items-center gap-1.5">
                  <CurrencyChip code={counterCurrency.code} size="sm" />
                </span>
              </div>
            </div>
          )}
        </FormSection>

        <FormSection icon={isCredit ? ArrowDownLeft : ArrowUpRight} title={isCredit ? "Origen externo" : "Destino externo"}>
          <Field
            label={counterCurrency ? `Monto en ${counterCurrency.code}` : "Monto externo"}
            icon={Hash}
            required
          >
            <Input
              type="number"
              step="0.00000001"
              inputMode="decimal"
              placeholder="0.00"
              value={externalAmount}
              onChange={(e) => setExternalAmount(e.target.value)}
              disabled={!counterCurrency}
            />
          </Field>
          <div className="rounded-md bg-muted/30 px-3 py-3 ring-1 ring-inset ring-border space-y-2 min-h-[88px]">
            {preview.state === "idle" && (
              <p className="text-xs text-muted-foreground">
                {isCredit ? "Acreditará" : "Debitará"} ≈ se calcula al ingresar el monto.
              </p>
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
                  <span className="text-xs text-muted-foreground">{isCredit ? "Acreditará" : "Debitará"}</span>
                  <span className={cn(
                    "flex items-center gap-1.5 font-mono tabular-nums text-base font-semibold",
                    !isCredit && "text-[var(--ops-negative,theme(colors.destructive.DEFAULT))]"
                  )}>
                    {!isCredit && "−"}
                    {preview.amountInAccountCurrency.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                    <CurrencyChip code={preview.accountCode} size="sm" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Calculator className="h-3 w-3" /> Tasa ({preview.ruleName})
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
                {debitInsufficient && (
                  <div className={cn(
                    "flex items-start gap-1.5 rounded-md px-2 py-1.5 text-[11px]",
                    debitInsufficient.blocking
                      ? "bg-destructive/10 text-destructive"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  )}>
                    <AlertTriangle className="h-3.5 w-3.5 mt-px shrink-0" />
                    <div className="flex-1">
                      {debitInsufficient.blocking ? (
                        <span>Saldo insuficiente. Activa &quot;saldo negativo&quot; en la cuenta para permitirlo.</span>
                      ) : (
                        <span>
                          Quedará en negativo:{" "}
                          <span className="font-mono tabular-nums font-semibold">
                            {debitInsufficient.projected.toLocaleString("es-MX", { maximumFractionDigits: 2 })} {preview.accountCode}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </FormSection>
      </div>

      <div className="space-y-3 mt-3">
        <Field label="Descripción" icon={FileText}>
          <Textarea
            rows={2}
            placeholder="Notas opcionales"
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
          disabled={submitting || preview.state !== "ok" || !!debitInsufficient?.blocking}
          className={cn(statusPending && "bg-[var(--ops-warning)] hover:bg-[var(--ops-warning)]/90 text-white")}
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting
            ? "Guardando…"
            : statusPending
              ? "Guardar pendiente"
              : preview.state === "ok"
                ? `${isCredit ? "Acreditar" : "Debitar"} · ${preview.amountInAccountCurrency.toLocaleString("es-MX", { maximumFractionDigits: 2 })} ${preview.accountCode}`
                : isCredit ? "Acreditar" : "Debitar"}
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}
