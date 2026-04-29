"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { Field, FormDialogHeader } from "@/components/ui/field";
import {
  Plus, Trash2, SquarePen, Loader2, Link as LinkIcon, Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  createRuleAndAssign,
} from "../../actions/account-actions";
import {
  assignRulesToAccount,
  unassignRuleFromAccount,
  updateExchangeRateRule,
} from "../../actions/exchange-rate-actions";
import type { AccountRow } from "../../lib/types";
import type { ExchangeRateRuleInput } from "../../lib/schemas";
import { ExchangeRateRuleForm } from "../exchange-rates/exchange-rate-rule-form";

export type RuleSummary = {
  ruleId: number;
  name: string;
  active: boolean;
  baseCurrencyId: number;
  quoteCurrencyId: number;
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  minAmount: number;
  maxAmount: number | null;
  rate: number;
};

type CurrencyOption = { currencyId: number; code: string; symbol: string };

export type RuleActionMode = "manage" | "create" | "edit";
export type RuleActionState = {
  account: AccountRow;
  mode: RuleActionMode;
  editRuleId?: number;
} | null;

interface MenuItemsProps {
  account: AccountRow;
  onAction: (mode: RuleActionMode) => void;
}

export function AccountRuleMenuItems({ account, onAction }: MenuItemsProps) {
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onSelect={(e) => {
          e.preventDefault();
          onAction("manage");
        }}
      >
        <LinkIcon className="h-4 w-4" /> Gestionar reglas asignadas
      </DropdownMenuItem>
      <DropdownMenuItem
        onSelect={(e) => {
          e.preventDefault();
          onAction("create");
        }}
      >
        <Plus className="h-4 w-4" /> Crear regla y asignar
      </DropdownMenuItem>
      {account.rulesCount > 0 && (
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            onAction("edit");
          }}
        >
          <SquarePen className="h-4 w-4" /> Editar reglas asignadas
        </DropdownMenuItem>
      )}
    </>
  );
}

interface DialogsProps {
  state: RuleActionState;
  onClose: () => void;
  rules: RuleSummary[];
  assignedByAccount: Record<number, RuleSummary[]>;
  currencies: CurrencyOption[];
  onChange?: () => void;
}

export function AccountRuleDialogs({
  state,
  onClose,
  rules,
  assignedByAccount,
  currencies,
  onChange,
}: DialogsProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);

  const account = state?.account ?? null;
  const mode = state?.mode ?? null;

  const compatibleRules = useMemo(
    () =>
      account
        ? rules.filter(
            (r) =>
              r.active &&
              (r.baseCurrencyId === account.currencyId ||
                r.quoteCurrencyId === account.currencyId),
          )
        : [],
    [rules, account],
  );

  const assignedRules = useMemo(
    () => (account ? assignedByAccount[account.accountId] ?? [] : []),
    [assignedByAccount, account],
  );

  useEffect(() => {
    if (mode === "manage" && account) {
      setSelectedIds(new Set(assignedRules.map((r) => r.ruleId)));
    }
    if (mode === "edit" && state?.editRuleId) {
      setEditingRuleId(state.editRuleId);
    } else if (mode === "edit" && assignedRules.length === 1) {
      setEditingRuleId(assignedRules[0].ruleId);
    } else if (mode !== "edit") {
      setEditingRuleId(null);
    }
  }, [mode, account, assignedRules, state?.editRuleId]);

  const editingRule = useMemo(
    () => assignedRules.find((r) => r.ruleId === editingRuleId) ?? null,
    [assignedRules, editingRuleId],
  );

  const refresh = () => {
    onChange?.();
    router.refresh();
  };

  const toggleId = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSaveAssignments = async () => {
    if (!account) return;
    setSubmitting(true);
    const r = await assignRulesToAccount({
      accountId: account.accountId,
      ruleIds: [...selectedIds],
    });
    setSubmitting(false);
    if (r.success) {
      toast.success(
        `Reglas actualizadas: +${r.data.assigned}, −${r.data.removed}`,
      );
      onClose();
      refresh();
    } else toast.error(r.error);
  };

  const handleQuickRemove = async (ruleId: number) => {
    if (!account) return;
    const r = await unassignRuleFromAccount(account.accountId, ruleId);
    if (r.success) {
      toast.success("Regla quitada");
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
    if (!editingRule) return { success: false, error: "Sin regla" };
    const r = await updateExchangeRateRule(editingRule.ruleId, payload);
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
        open={mode === "manage"}
        onOpenChange={(o) => {
          if (!o) onClose();
        }}
        a11yTitle="Gestionar reglas asignadas"
        description="Asigna o quita reglas vigentes para esta cuenta."
        desktopMaxWidth="sm:max-w-md"
      >
        {account && (
          <>
            <FormDialogHeader
              icon={LinkIcon}
              title="Reglas vigentes"
              description={`Cuenta ${account.name} · ${account.currencyCode}`}
            />
            <div className="space-y-2 mt-4 max-h-[60vh] overflow-y-auto">
              {compatibleRules.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No hay reglas activas que involucren {account.currencyCode}. Crea una nueva.
                </p>
              ) : (
                compatibleRules.map((r) => {
                  const checked = selectedIds.has(r.ruleId);
                  return (
                    <button
                      key={r.ruleId}
                      type="button"
                      onClick={() => toggleId(r.ruleId)}
                      className={`w-full flex items-start gap-3 rounded-md border p-3 text-left transition-colors ${
                        checked
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/40"
                      }`}
                    >
                      <div
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          checked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground"
                        }`}
                      >
                        {checked && <Check className="h-3 w-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{r.name}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {r.baseCurrencyCode}↔{r.quoteCurrencyCode}
                          </span>
                        </div>
                        <div className="text-xs font-mono tabular-nums text-muted-foreground mt-0.5">
                          [{r.minAmount} – {r.maxAmount === null ? "∞" : r.maxAmount}) @ {r.rate}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                variant="brand"
                onClick={handleSaveAssignments}
                disabled={submitting}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </>
        )}
      </ResponsiveFormDialog>

      <ResponsiveFormDialog
        open={mode === "create"}
        onOpenChange={(o) => {
          if (!o) onClose();
        }}
        a11yTitle="Crear regla y asignar"
        description="Define una nueva regla y se asignará automáticamente a la cuenta."
        desktopMaxWidth="sm:max-w-2xl"
      >
        {account && (
          <ExchangeRateRuleForm
            key={`create-${account.accountId}`}
            defaultValues={{ quoteCurrencyId: account.currencyId, minAmount: 0 }}
            currencies={currencies}
            onSubmit={handleCreate}
            onCancel={onClose}
            lockQuoteCurrency
            submitLabel="Crear y asignar"
            headerTitle="Crear regla y asignar"
            headerDescription={`Cuenta ${account.name} · ${account.currencyCode}`}
          />
        )}
      </ResponsiveFormDialog>

      <ResponsiveFormDialog
        open={mode === "edit"}
        onOpenChange={(o) => {
          if (!o) onClose();
        }}
        a11yTitle="Editar regla asignada"
        description="Modifica una regla vigente para esta cuenta."
        desktopMaxWidth="sm:max-w-2xl"
      >
        {account && (
          <>
            {assignedRules.length > 1 && !editingRule && (
              <>
                <FormDialogHeader
                  icon={SquarePen}
                  title="Editar regla"
                  description={`Selecciona cuál de las ${assignedRules.length} reglas vigentes editar`}
                />
                <div className="space-y-2 mt-4">
                  {assignedRules.map((r) => (
                    <button
                      key={r.ruleId}
                      type="button"
                      onClick={() => setEditingRuleId(r.ruleId)}
                      className="w-full flex items-center justify-between rounded-md border p-3 hover:bg-muted/40 text-left"
                    >
                      <div>
                        <div className="font-medium text-sm">{r.name}</div>
                        <div className="text-xs font-mono tabular-nums text-muted-foreground">
                          [{r.minAmount} – {r.maxAmount === null ? "∞" : r.maxAmount}) @ {r.rate}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleQuickRemove(r.ruleId);
                        }}
                        aria-label="Quitar regla"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </button>
                  ))}
                </div>
              </>
            )}
            {editingRule && (
              <ExchangeRateRuleForm
                key={`edit-${editingRule.ruleId}`}
                defaultValues={editingRule}
                currencies={currencies}
                onSubmit={handleUpdate}
                onCancel={onClose}
                submitLabel="Actualizar"
                headerTitle="Editar regla"
                headerDescription={`Cuenta ${account.name} · ${account.currencyCode}`}
              />
            )}
          </>
        )}
      </ResponsiveFormDialog>
    </>
  );
}

export async function removeRuleFromAccount(
  accountId: number,
  ruleId: number,
): Promise<boolean> {
  const r = await unassignRuleFromAccount(accountId, ruleId);
  if (r.success) {
    toast.success("Regla desasignada");
    return true;
  }
  toast.error(r.error);
  return false;
}
