"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { Field, FormDialogHeader } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import {
  ArrowDownLeft, ArrowUpRight, ArrowRightLeft, Settings2, Wallet,
  Hash, FileText, Type, Calendar, Clock, Plus, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createOperation } from "../../actions/operation-actions";
import type { OperationFormAccount } from "../../queries/operation-queries";

export type SingleOpKind = "deposit" | "withdrawal" | "adjustment";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: OperationFormAccount;
  initialKind?: SingleOpKind;
};

const KIND_TABS: {
  id: SingleOpKind;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}[] = [
  { id: "deposit",    label: "Depósito",  icon: ArrowDownLeft, tone: "text-[var(--ops-success)]" },
  { id: "withdrawal", label: "Retiro",    icon: ArrowUpRight,  tone: "text-rose-500" },
  { id: "adjustment", label: "Ajuste",    icon: Settings2,     tone: "text-muted-foreground" },
];

export function SingleOperationForm({ open, onOpenChange, account, initialKind = "deposit" }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [kind, setKind] = useState<SingleOpKind>(initialKind);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [statusPending, setStatusPending] = useState(false);
  const [continueRegistering, setContinueRegistering] = useState(false);

  useEffect(() => {
    if (open) setKind(initialKind);
  }, [open, initialKind]);

  const reset = () => {
    setAmount(""); setDescription(""); setReference("");
    setOccurredAt(""); setStatusPending(false);
  };

  const validate = () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n === 0) return "Monto inválido";
    if (kind !== "adjustment" && n <= 0) return "El monto debe ser positivo";
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSubmitting(true);
    const r = await createOperation({
      accountId: account.accountId,
      type: kind,
      amount: Number(amount),
      description: description.trim() || null,
      reference: reference.trim() || null,
      occurredAt: occurredAt ? new Date(occurredAt).toISOString() : null,
      status: statusPending ? "pending" : "confirmed",
    });
    setSubmitting(false);
    if (r.success) {
      toast.success(statusPending ? "Pendiente registrada" : "Operación confirmada");
      if (continueRegistering) {
        setAmount(""); setDescription(""); setReference("");
        router.refresh();
      } else {
        onOpenChange(false); reset(); router.refresh();
      }
    } else toast.error(r.error);
  };

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={(o) => { if (!o) { onOpenChange(false); reset(); } }}
      a11yTitle="Nueva operación"
      description="Depósito, retiro o ajuste sobre la cuenta."
      desktopMaxWidth="sm:max-w-lg"
    >
      <FormDialogHeader
        icon={ArrowRightLeft}
        title="Nueva operación"
        description={`${account.groupName} · ${account.accountNumber} · ${account.currencyCode}`}
      />

      <div className="mt-3 flex items-center gap-1 rounded-lg bg-muted/40 p-1">
        {KIND_TABS.map((t) => {
          const Icon = t.icon;
          const isActive = kind === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setKind(t.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors",
                isActive
                  ? "bg-background shadow ring-1 ring-border text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", isActive && t.tone)} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-4 mt-4">
        <FormSection icon={Wallet} title="Cuenta">
          <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 ring-1 ring-inset ring-border">
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium truncate">{account.name}</span>
              <span className="text-[10px] text-muted-foreground font-mono tabular-nums truncate">
                {account.groupName} · {account.accountNumber}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-muted-foreground">Saldo actual</span>
              <span className="font-mono tabular-nums text-sm font-semibold">
                {account.balance.toLocaleString("es-MX", {
                  minimumFractionDigits: account.currencyDecimals,
                  maximumFractionDigits: account.currencyDecimals,
                })} {account.currencyCode}
              </span>
            </div>
          </div>
        </FormSection>

        <FormSection
          icon={kind === "deposit" ? ArrowDownLeft : kind === "withdrawal" ? ArrowUpRight : Settings2}
          title="Monto"
        >
          <Field
            label={kind === "adjustment" ? "Ajuste (positivo o negativo)" : "Monto"}
            icon={Hash}
            required
            hint={
              kind === "deposit"
                ? "El saldo aumenta en este monto."
                : kind === "withdrawal"
                  ? "El saldo disminuye en este monto. Será rechazado si no alcanza."
                  : "Use signo positivo para sumar, negativo para restar."
            }
          >
            <Input
              type="number"
              step="0.00000001"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Descripción" icon={FileText}>
            <Textarea
              rows={2}
              placeholder="Detalle visible en el historial"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field label="Referencia" icon={Type} hint="Identificador externo opcional (folio, recibo).">
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </Field>
          <Field label="Fecha" icon={Calendar} hint="Por defecto: ahora.">
            <Input
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </Field>
          <Field label="Guardar como pendiente" icon={Clock} hint="No modifica saldo hasta confirmarse.">
            <div className="flex items-center gap-3">
              <Switch checked={statusPending} onCheckedChange={setStatusPending} />
              <span className="text-sm text-muted-foreground">{statusPending ? "Sí" : "No"}</span>
            </div>
          </Field>
          <Field label="Continuar registrando" icon={Plus} hint="Mantiene el formulario abierto tras guardar.">
            <div className="flex items-center gap-3">
              <Switch checked={continueRegistering} onCheckedChange={setContinueRegistering} />
              <span className="text-sm text-muted-foreground">{continueRegistering ? "Sí" : "No"}</span>
            </div>
          </Field>
        </FormSection>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <Button
          type="button"
          variant="outline"
          onClick={() => { onOpenChange(false); reset(); }}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          variant="brand"
          onClick={handleSubmit}
          disabled={submitting}
          className={statusPending ? "bg-[var(--ops-warning)] hover:bg-[var(--ops-warning)]/90 text-white" : undefined}
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting
            ? "Guardando…"
            : statusPending
              ? "Guardar pendiente"
              : "Confirmar operación"}
        </Button>
      </div>
    </ResponsiveFormDialog>
  );
}
