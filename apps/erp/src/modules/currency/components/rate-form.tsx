"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Field, FormDialogHeader } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import { CircleDollarSign, Hash, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import type { ExchangeRateRow, CurrencyOption } from "../lib/types";

export type RateFormPayload =
  | { mode: "create"; baseCurrencyId: number; quoteCurrencyId: number; rate: number; note?: string | null }
  | { mode: "update"; exchangeRateId: number; rate: number; expectedVersion: number; note?: string | null };

interface RateFormProps {
  mode: "create" | "update";
  existingRate?: ExchangeRateRow;
  currencies: CurrencyOption[];
  onSubmit: (payload: RateFormPayload) => Promise<{ success: boolean; error?: string }>;
  onCancel: () => void;
}

export function RateForm({ mode, existingRate, currencies, onSubmit, onCancel }: RateFormProps) {
  const [baseCurrencyId, setBaseCurrencyId] = useState<string>(
    existingRate ? String(existingRate.baseCurrencyId) : ""
  );
  const [quoteCurrencyId, setQuoteCurrencyId] = useState<string>(
    existingRate ? String(existingRate.quoteCurrencyId) : ""
  );
  const [rate, setRate] = useState(existingRate ? String(existingRate.rate) : "");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!existingRate) return;
    setBaseCurrencyId(String(existingRate.baseCurrencyId));
    setQuoteCurrencyId(String(existingRate.quoteCurrencyId));
    setRate(String(existingRate.rate));
  }, [existingRate]);

  const baseCode = currencies.find((c) => String(c.currencyId) === baseCurrencyId)?.code;
  const quoteCode = currencies.find((c) => String(c.currencyId) === quoteCurrencyId)?.code;

  const validate = (): string | null => {
    if (mode === "create") {
      if (!baseCurrencyId) return "Selecciona moneda base";
      if (!quoteCurrencyId) return "Selecciona moneda destino";
      if (baseCurrencyId === quoteCurrencyId) return "Base y destino deben ser monedas distintas";
    }
    const r = Number(rate);
    if (!rate || !Number.isFinite(r) || r <= 0) return "La tasa debe ser mayor a 0";
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSubmitting(true);
    const payload: RateFormPayload =
      mode === "create"
        ? {
            mode: "create",
            baseCurrencyId: Number(baseCurrencyId),
            quoteCurrencyId: Number(quoteCurrencyId),
            rate: Number(rate),
            note: note.trim() || null,
          }
        : {
            mode: "update",
            exchangeRateId: existingRate!.exchangeRateId,
            rate: Number(rate),
            expectedVersion: existingRate!.version,
            note: note.trim() || null,
          };
    const result = await onSubmit(payload);
    setSubmitting(false);
    if (!result.success && result.error) toast.error(result.error);
  };

  return (
    <>
      <FormDialogHeader
        icon={CircleDollarSign}
        title={mode === "create" ? "Nueva tasa de cambio" : "Actualizar tasa de cambio"}
        description={
          mode === "create"
            ? "Define un nuevo par de monedas y su tasa inicial."
            : "Registra la nueva tasa. El cambio queda auditado en el historial."
        }
      />
      <div className="space-y-4 mt-4">
        <FormSection icon={Hash} title="Par de monedas">
          {mode === "create" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Moneda base" required>
                <Select value={baseCurrencyId} onValueChange={setBaseCurrencyId}>
                  <SelectTrigger><SelectValue placeholder="Base" /></SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c.currencyId} value={String(c.currencyId)}>
                        {c.code} — {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Moneda destino" required>
                <Select value={quoteCurrencyId} onValueChange={setQuoteCurrencyId}>
                  <SelectTrigger><SelectValue placeholder="Destino" /></SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c.currencyId} value={String(c.currencyId)}>
                        {c.code} — {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          ) : (
            <div className="rounded-md bg-muted/40 px-3 py-2 text-sm font-mono tabular-nums text-muted-foreground">
              {existingRate?.baseCurrencyCode} → {existingRate?.quoteCurrencyCode}
            </div>
          )}

          {mode === "update" && (
            <Field label="Tasa actual" hint="Solo lectura — referencia antes de actualizar">
              <Input
                value={existingRate ? existingRate.rate.toLocaleString("es-MX", { maximumFractionDigits: 8 }) : ""}
                readOnly
                disabled
                className="font-mono tabular-nums"
              />
            </Field>
          )}

          <Field
            label={baseCode && quoteCode ? `Tasa (1 ${baseCode} = ? ${quoteCode})` : "Nueva tasa"}
            required
          >
            <Input
              type="number"
              step="0.00000001"
              inputMode="decimal"
              placeholder="0.00"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="font-mono tabular-nums"
            />
          </Field>

          <Field label="Nota (opcional)" hint="Motivo del cambio, referencia, etc.">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej. ajuste según mercado informal"
              rows={2}
            />
          </Field>
        </FormSection>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="button" variant="brand" onClick={handleSubmit} disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? "Guardando…" : mode === "create" ? "Crear tasa" : "Actualizar"}
        </Button>
      </div>
    </>
  );
}
