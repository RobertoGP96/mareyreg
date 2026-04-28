"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Field, FormDialogHeader } from "@/components/ui/field";
import {
  Calculator, Plus, Trash2, SquarePen, Loader2, Link as LinkIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  assignRuleToAccount,
  createRuleAndAssign,
} from "../../actions/account-actions";
import { updateExchangeRateRule } from "../../actions/exchange-rate-actions";
import type { AccountRow } from "../../lib/types";
import type { ExchangeRateRuleInput } from "../../lib/schemas";
import { ExchangeRateRuleForm } from "../exchange-rates/exchange-rate-rule-form";

export type RuleWithRanges = {
  ruleId: number;
  name: string;
  kind: "fixed" | "range";
  active: boolean;
  baseCurrencyId: number;
  quoteCurrencyId: number;
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  ranges: Array<{
    rangeId: number;
    minAmount: number;
    maxAmount: number | null;
    rate: number;
  }>;
};

type CurrencyOption = { currencyId: number; code: string; symbol: string };

export type RuleActionMode = "assign" | "create" | "edit" | "remove";
export type RuleActionState = {
  account: AccountRow;
  mode: Exclude<RuleActionMode, "remove">;
} | null;

interface MenuItemsProps {
  account: AccountRow;
  rules: RuleWithRanges[];
  onAction: (mode: RuleActionMode) => void;
}

export function AccountRuleMenuItems({ account, rules, onAction }: MenuItemsProps) {
  const compatibleCount = useMemo(
    () =>
      rules.filter(
        (r) =>
          (r.baseCurrencyId === account.currencyId ||
            r.quoteCurrencyId === account.currencyId) &&
          r.ruleId !== account.ruleId
      ).length,
    [rules, account.currencyId, account.ruleId]
  );

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onSelect={(e) => { e.preventDefault(); onAction("assign"); }}
        disabled={compatibleCount === 0}
      >
        <LinkIcon className="h-4 w-4" /> Asignar regla existente
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onAction("create"); }}>
        <Plus className="h-4 w-4" /> Crear regla y asignar
      </DropdownMenuItem>
      {account.ruleId && (
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onAction("edit"); }}>
          <SquarePen className="h-4 w-4" /> Editar regla actual
        </DropdownMenuItem>
      )}
      {account.ruleId && (
        <DropdownMenuItem
          onSelect={(e) => { e.preventDefault(); onAction("remove"); }}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4" /> Quitar regla
        </DropdownMenuItem>
      )}
    </>
  );
}

interface DialogsProps {
  state: RuleActionState;
  onClose: () => void;
  rules: RuleWithRanges[];
  currencies: CurrencyOption[];
  onChange?: () => void;
}

export function AccountRuleDialogs({ state, onClose, rules, currencies, onChange }: DialogsProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [selectedRuleId, setSelectedRuleId] = useState<string>("");

  const account = state?.account ?? null;
  const mode = state?.mode ?? null;

  const compatibleRules = useMemo(
    () =>
      account
        ? rules.filter(
            (r) =>
              (r.baseCurrencyId === account.currencyId ||
                r.quoteCurrencyId === account.currencyId) &&
              r.ruleId !== account.ruleId
          )
        : [],
    [rules, account]
  );

  const currentRule = useMemo(
    () =>
      account?.ruleId
        ? rules.find((r) => r.ruleId === account.ruleId) ?? null
        : null,
    [rules, account]
  );

  const refresh = () => {
    onChange?.();
    router.refresh();
  };

  const handleAssign = async () => {
    if (!account || !selectedRuleId) {
      toast.error("Selecciona una regla");
      return;
    }
    setSubmitting(true);
    const r = await assignRuleToAccount(account.accountId, Number(selectedRuleId));
    setSubmitting(false);
    if (r.success) {
      toast.success("Regla asignada");
      setSelectedRuleId("");
      onClose();
      refresh();
    } else toast.error(r.error);
  };

  const handleCreate = async (payload: ExchangeRateRuleInput) => {
    if (!account) return { success: false };
    const r = await createRuleAndAssign(account.accountId, payload);
    if (r.success) {
      toast.success("Regla creada y asignada");
      onClose();
      refresh();
      return { success: true };
    }
    return { success: false, error: r.error };
  };

  const handleUpdate = async (payload: ExchangeRateRuleInput) => {
    if (!currentRule) return { success: false, error: "Sin regla" };
    const r = await updateExchangeRateRule(currentRule.ruleId, payload);
    if (r.success) {
      toast.success("Regla actualizada");
      onClose();
      refresh();
      return { success: true };
    }
    return { success: false, error: r.error };
  };

  return (
    <>
      <ResponsiveFormDialog
        open={mode === "assign"}
        onOpenChange={(o) => { if (!o) onClose(); }}
        a11yTitle="Asignar regla existente"
        description="Vincula una regla activa que involucre la moneda de esta cuenta."
        desktopMaxWidth="sm:max-w-md"
      >
        {account && (
          <>
            <FormDialogHeader
              icon={LinkIcon}
              title="Asignar regla existente"
              description={`Cuenta ${account.name} · ${account.currencyCode}`}
            />
            <div className="space-y-4 mt-4">
              <Field label="Regla" icon={Calculator} required>
                <Select value={selectedRuleId} onValueChange={setSelectedRuleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una regla" />
                  </SelectTrigger>
                  <SelectContent>
                    {compatibleRules.map((r) => (
                      <SelectItem key={r.ruleId} value={String(r.ruleId)}>
                        {r.name} · {r.baseCurrencyCode}↔{r.quoteCurrencyCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {compatibleRules.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No hay reglas activas que involucren {account.currencyCode}. Crea una nueva.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button variant="brand" onClick={handleAssign} disabled={submitting || !selectedRuleId}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "Asignando…" : "Asignar"}
              </Button>
            </div>
          </>
        )}
      </ResponsiveFormDialog>

      <ResponsiveFormDialog
        open={mode === "create"}
        onOpenChange={(o) => { if (!o) onClose(); }}
        a11yTitle="Crear regla y asignar"
        description="Define una nueva regla y se asignará automáticamente a la cuenta."
        desktopMaxWidth="sm:max-w-2xl"
      >
        {account && (
          <ExchangeRateRuleForm
            key={`create-${account.accountId}`}
            defaultValues={{ baseCurrencyId: account.currencyId, kind: "range" }}
            currencies={currencies}
            onSubmit={handleCreate}
            onCancel={onClose}
            lockBaseCurrency
            submitLabel="Crear y asignar"
            headerTitle="Crear regla y asignar"
            headerDescription={`Cuenta ${account.name} · ${account.currencyCode}`}
          />
        )}
      </ResponsiveFormDialog>

      <ResponsiveFormDialog
        open={mode === "edit"}
        onOpenChange={(o) => { if (!o) onClose(); }}
        a11yTitle="Editar regla actual"
        description="Modifica la regla asignada a esta cuenta."
        desktopMaxWidth="sm:max-w-2xl"
      >
        {account && currentRule && (
          <ExchangeRateRuleForm
            key={`edit-${currentRule.ruleId}`}
            defaultValues={currentRule}
            currencies={currencies}
            onSubmit={handleUpdate}
            onCancel={onClose}
            submitLabel="Actualizar"
            headerTitle="Editar regla"
            headerDescription={`Cuenta ${account.name} · ${account.currencyCode}`}
          />
        )}
      </ResponsiveFormDialog>
    </>
  );
}

export async function removeRuleFromAccount(accountId: number): Promise<boolean> {
  const r = await assignRuleToAccount(accountId, null);
  if (r.success) {
    toast.success("Regla desasignada");
    return true;
  }
  toast.error(r.error);
  return false;
}
