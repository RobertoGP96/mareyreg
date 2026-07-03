"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { ToastDetail, ToastLines } from "@/components/ui/toast-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { Field, FormDialogHeader } from "@/components/ui/field";
import { CalendarDays, HandCoins, Loader2 } from "lucide-react";
import { registerInvoicePayment } from "../actions/invoice-actions";
import { MultiCurrencyPaymentFields, type CurrencyOption, type PaymentFieldValue } from "./multi-currency-payment-fields";

const PAYMENT_METHODS = [
  { value: "cash", label: "Efectivo" },
  { value: "card", label: "Tarjeta" },
  { value: "transfer", label: "Transferencia" },
  { value: "other", label: "Otro" },
];

function money(n: number): string {
  return n.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export interface InvoicePayTarget {
  invoiceId: number;
  folio: string;
  customerName: string;
  balance: number;
}

interface Props {
  payTarget: InvoicePayTarget | null;
  onClose: () => void;
  currencies: CurrencyOption[];
  baseCurrencyId: number;
  baseCurrencyCode: string;
}

/**
 * Diálogo de pago de cuentas por cobrar: usa el mismo componente de pagos
 * multi-moneda que el POS. El equivalente mostrado es referencial; el server
 * SIEMPRE recalcula la conversión con la tasa vigente dentro de la tx.
 */
export function InvoicePaymentDialog({ payTarget, onClose, currencies, baseCurrencyId, baseCurrencyCode }: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [payments, setPayments] = useState<PaymentFieldValue[]>([
    { currencyId: baseCurrencyId, amountTendered: "", paymentMethod: "transfer", reference: "" },
  ]);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  const targetKey = payTarget?.invoiceId ?? null;
  const [initializedFor, setInitializedFor] = useState<number | null>(null);
  if (payTarget && initializedFor !== targetKey) {
    setInitializedFor(targetKey);
    setPayments([
      {
        currencyId: baseCurrencyId,
        amountTendered: String(Math.round(payTarget.balance)),
        paymentMethod: "transfer",
        reference: "",
      },
    ]);
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setNotes("");
  }

  const handleClose = () => {
    setInitializedFor(null);
    onClose();
  };

  const handlePay = async () => {
    if (!payTarget) return;
    const row = payments[0];
    const amountTendered = Number(row?.amountTendered);
    if (!row || !Number.isFinite(amountTendered) || amountTendered <= 0) {
      toast.error("Captura el monto entregado");
      return;
    }

    setIsSubmitting(true);
    const result = await registerInvoicePayment(payTarget.invoiceId, {
      currencyId: row.currencyId === baseCurrencyId ? null : row.currencyId,
      amountTendered,
      paymentMethod: row.paymentMethod,
      paidAt: paymentDate,
      reference: notes || undefined,
    });
    setIsSubmitting(false);
    if (result.success) {
      const currencyCode = currencies.find((c) => c.currencyId === row.currencyId)?.code ?? baseCurrencyCode;
      const methodLabel = PAYMENT_METHODS.find((m) => m.value === row.paymentMethod)?.label ?? row.paymentMethod;
      toast.success("Pago registrado", {
        description: (
          <ToastLines>
            <ToastDetail
              label={`Factura ${payTarget.folio}`}
              value={`${money(amountTendered)} ${currencyCode}`}
              mono
            />
            <ToastDetail label="Metodo" value={methodLabel} />
          </ToastLines>
        ),
      });
      handleClose();
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <ResponsiveFormDialog
      open={!!payTarget}
      onOpenChange={(open) => !open && handleClose()}
      a11yTitle="Registrar pago"
      description="Registra un pago de cliente contra esta factura."
      desktopMaxWidth="sm:max-w-lg"
    >
      {payTarget && (
        <>
          <FormDialogHeader
            icon={HandCoins}
            title={`Pago · ${payTarget.folio}`}
            description={`${payTarget.customerName} — saldo pendiente ${money(payTarget.balance)} ${baseCurrencyCode}`}
          />
          <div className="space-y-5 mt-4">
            <MultiCurrencyPaymentFields
              currencies={currencies}
              baseCurrencyId={baseCurrencyId}
              baseCurrencyCode={baseCurrencyCode}
              paymentMethods={PAYMENT_METHODS}
              total={payTarget.balance}
              value={payments}
              onChange={(next) => setPayments(next.slice(0, 1))}
            />
            <Field label="Fecha de pago" icon={CalendarDays} required>
              <Input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </Field>
            <Field label="Notas">
              <Textarea
                placeholder="Referencia, numero de transferencia…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button type="button" variant="brand" disabled={isSubmitting} onClick={handlePay}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? "Registrando…" : "Registrar pago"}
              </Button>
            </div>
          </div>
        </>
      )}
    </ResponsiveFormDialog>
  );
}
