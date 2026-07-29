"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { ToastDetail, ToastLines, ToastNote } from "@/components/ui/toast-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { Field, FormDialogHeader } from "@/components/ui/field";
import { CalendarDays, CreditCard, Hash, HandCoins, Loader2 } from "lucide-react";
import { registerSupplierPayment } from "../actions/supplier-bill-actions";
import type { SupplierBillListItem } from "../queries/supplier-bill-queries";

const PAYMENT_METHODS = [
  { value: "transfer", label: "Transferencia" },
  { value: "cash", label: "Efectivo" },
  { value: "check", label: "Cheque" },
  { value: "card", label: "Tarjeta" },
  { value: "other", label: "Otro" },
];

function money(n: number): string {
  return n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface CurrencyOption {
  currencyId: number;
  code: string;
  rateToBase: number | null;
}

interface Props {
  payTarget: SupplierBillListItem | null;
  onClose: () => void;
  currencies: CurrencyOption[];
  baseCurrencyId: number;
  baseCurrencyCode: string;
}

/**
 * Formulario de pago a proveedor con soporte de moneda entregada distinta a
 * la moneda de la factura. El equivalente mostrado en vivo es solo
 * referencial: el server SIEMPRE recalcula la conversion dentro de la tx.
 */
export function SupplierPaymentDialog({ payTarget, onClose, currencies, baseCurrencyId, baseCurrencyCode }: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [payCurrencyId, setPayCurrencyId] = useState<string>("");
  const [amountTendered, setAmountTendered] = useState<string>("");

  const billCurrencyIdFor = (b: SupplierBillListItem): number =>
    currencies.find((c) => c.code === b.currencyCode)?.currencyId ?? baseCurrencyId;

  // Reinicializa moneda/monto cuando cambia el objetivo del pago (apertura del dialog).
  const targetKey = payTarget?.billId ?? null;
  const [initializedFor, setInitializedFor] = useState<number | null>(null);
  if (payTarget && initializedFor !== targetKey) {
    setInitializedFor(targetKey);
    setPayCurrencyId(String(billCurrencyIdFor(payTarget)));
    setAmountTendered(payTarget.balance.toFixed(2));
  }

  const payCurrency = currencies.find((c) => c.currencyId === Number(payCurrencyId));
  const payTargetCurrencyId = payTarget ? billCurrencyIdFor(payTarget) : baseCurrencyId;
  const payTenderedDiffers = payCurrencyId !== "" && Number(payCurrencyId) !== payTargetCurrencyId;
  const payAmountBillCurrency =
    payTenderedDiffers && payCurrency?.rateToBase && amountTendered
      ? (Number(amountTendered) * payCurrency.rateToBase) /
        (currencies.find((c) => c.currencyId === payTargetCurrencyId)?.rateToBase ?? 1)
      : null;

  const handleClose = () => {
    setPayCurrencyId("");
    setAmountTendered("");
    setInitializedFor(null);
    onClose();
  };

  const handlePay = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!payTarget) return;
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const method = fd.get("method") as string;
    const tenderedAmount = Number(fd.get("amountTendered"));
    const result = await registerSupplierPayment({
      billId: payTarget.billId,
      amount: payTenderedDiffers ? payAmountBillCurrency ?? tenderedAmount : tenderedAmount,
      method,
      paymentDate: fd.get("paymentDate") as string,
      notes: (fd.get("notes") as string) || undefined,
      currencyId: payCurrencyId ? Number(payCurrencyId) : undefined,
      amountTendered: tenderedAmount,
    });
    setIsSubmitting(false);
    if (result.success) {
      const methodLabel = PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method;
      toast.success("Pago registrado", {
        description: (
          <ToastLines>
            <ToastDetail
              label={`Factura ${payTarget.folio}`}
              value={`${money(tenderedAmount)} ${payCurrency?.code ?? payTarget.currencyCode ?? baseCurrencyCode}`}
              mono
            />
            <ToastNote>{methodLabel}</ToastNote>
          </ToastLines>
        ),
      });
      handleClose();
      router.refresh();
    } else toast.error(result.error);
  };

  return (
    <ResponsiveFormDialog
      open={!!payTarget}
      onOpenChange={(open) => !open && handleClose()}
      a11yTitle="Registrar pago"
      description="Registra un pago a proveedor contra esta factura."
      desktopMaxWidth="sm:max-w-lg"
    >
      {payTarget && (
        <>
          <FormDialogHeader
            icon={HandCoins}
            title={`Pago · ${payTarget.folio}`}
            description={`${payTarget.supplierName} — saldo pendiente ${money(payTarget.balance)} ${payTarget.currencyCode ?? baseCurrencyCode}`}
          />
          <form onSubmit={handlePay} className="space-y-5 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Monto entregado" icon={Hash} required>
                <Input
                  name="amountTendered"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amountTendered}
                  onChange={(e) => setAmountTendered(e.target.value)}
                />
              </Field>
              <Field label="Moneda entregada">
                <Select value={payCurrencyId} onValueChange={setPayCurrencyId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Moneda" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c.currencyId} value={String(c.currencyId)}>
                        {c.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {payTenderedDiffers && (
              payAmountBillCurrency != null ? (
                <p className="text-xs text-muted-foreground font-mono tabular-nums">
                  ≈ {money(payAmountBillCurrency)} {payTarget.currencyCode ?? baseCurrencyCode} · tasa vigente
                </p>
              ) : (
                <p className="text-xs text-destructive">
                  No hay tasa de cambio configurada para {payCurrency?.code}.
                </p>
              )
            )}
            <Field label="Fecha de pago" icon={CalendarDays} required>
              <Input name="paymentDate" type="date" required defaultValue={new Date().toISOString().split("T")[0]} />
            </Field>
            <Field label="Metodo de pago" icon={CreditCard} required>
              <Select name="method" defaultValue="transfer">
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Notas">
              <Textarea name="notes" placeholder="Referencia, numero de transferencia…" />
            </Field>
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button type="submit" variant="brand" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? "Registrando…" : "Registrar pago"}
              </Button>
            </div>
          </form>
        </>
      )}
    </ResponsiveFormDialog>
  );
}
