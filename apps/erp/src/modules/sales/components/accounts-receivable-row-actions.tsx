"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { HandCoins } from "lucide-react";
import { InvoicePaymentDialog, type InvoicePayTarget } from "./invoice-payment-dialog";
import type { CurrencyOption } from "./multi-currency-payment-fields";

interface Props {
  target: InvoicePayTarget;
  currencies: CurrencyOption[];
  baseCurrencyId: number;
  baseCurrencyCode: string;
}

/** Botón "Cobrar" + diálogo de pago multi-moneda para una fila de cuentas por cobrar. */
export function AccountsReceivableRowActions({ target, currencies, baseCurrencyId, baseCurrencyCode }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <HandCoins className="w-4 h-4" />
        Cobrar
      </Button>
      <InvoicePaymentDialog
        payTarget={open ? target : null}
        onClose={() => setOpen(false)}
        currencies={currencies}
        baseCurrencyId={baseCurrencyId}
        baseCurrencyCode={baseCurrencyCode}
      />
    </>
  );
}
