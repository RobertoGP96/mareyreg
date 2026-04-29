"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { Field, FormDialogHeader } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Wallet, Hash, Type, MinusCircle, Loader2, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { updateAccount } from "../../actions/account-actions";
import { generateUniqueAccountName } from "../../lib/account-name";

export type AccountEditTarget = {
  accountId: number;
  name: string;
  accountNumber: string;
  allowNegativeBalance: boolean;
  groupName: string;
  currencyCode: string;
};

interface Props {
  account: AccountEditTarget | null;
  onClose: () => void;
  onSaved?: () => void;
}

export function AccountEditDialog({ account, onClose, onSaved }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [allowNegativeBalance, setAllowNegativeBalance] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (account) {
      setName(account.name);
      setAccountNumber(account.accountNumber);
      setAllowNegativeBalance(account.allowNegativeBalance);
    }
  }, [account?.accountId, account?.name, account?.accountNumber, account?.allowNegativeBalance]);

  const handleSubmit = async () => {
    if (!account) return;
    if (!name.trim()) { toast.error("Nombre requerido"); return; }
    const numberUpper = accountNumber.trim().toUpperCase();
    if (!/^[A-Z0-9_-]+$/.test(numberUpper)) {
      toast.error("Número solo mayúsculas, números, _ y -");
      return;
    }
    setSubmitting(true);
    const r = await updateAccount(account.accountId, {
      name: name.trim(),
      accountNumber: numberUpper,
      allowNegativeBalance,
    });
    setSubmitting(false);
    if (r.success) {
      toast.success("Cuenta actualizada");
      onClose();
      onSaved?.();
      router.refresh();
    } else toast.error(r.error);
  };

  return (
    <ResponsiveFormDialog
      open={!!account}
      onOpenChange={(o) => { if (!o && !submitting) onClose(); }}
      a11yTitle="Editar cuenta"
      description="Modifica los datos editables de la cuenta. Grupo y moneda no se pueden cambiar."
      desktopMaxWidth="sm:max-w-lg"
    >
      {account && (
        <>
          <FormDialogHeader
            icon={Wallet}
            title="Editar cuenta"
            description={`${account.groupName} · ${account.currencyCode}`}
          />
          <div className="space-y-4 mt-4">
            <FormSection icon={Wallet} title="Datos editables">
              <Field
                label="Número de cuenta"
                icon={Hash}
                required
                hint="Mayúsculas, números, _ y -."
              >
                <Input
                  placeholder="ALEJANDRO_STGO-USD"
                  value={accountNumber}
                  maxLength={40}
                  onChange={(e) => setAccountNumber(e.target.value.toUpperCase())}
                />
              </Field>
              <Field label="Nombre" icon={Type} required>
                <InputGroup>
                  <InputGroupInput
                    placeholder="Cuenta principal USD"
                    value={name}
                    maxLength={120}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      type="button"
                      size="icon-xs"
                      aria-label="Generar nombre único"
                      title="Generar nombre único"
                      onClick={() => {
                        setName(generateUniqueAccountName(account.currencyCode));
                      }}
                    >
                      <Sparkles className="size-3.5" />
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
              <Field
                label="Permitir saldo negativo"
                icon={MinusCircle}
                hint="Activa cuando la cuenta represente deuda pendiente y pueda quedar en rojo."
              >
                <div className="flex items-center gap-3">
                  <Switch
                    checked={allowNegativeBalance}
                    onCheckedChange={setAllowNegativeBalance}
                  />
                  <span className="text-sm text-muted-foreground">
                    {allowNegativeBalance ? "Sí (puede ir a rojo)" : "No (saldo ≥ 0)"}
                  </span>
                </div>
              </Field>
            </FormSection>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="brand"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Guardando…" : "Actualizar"}
            </Button>
          </div>
        </>
      )}
    </ResponsiveFormDialog>
  );
}
