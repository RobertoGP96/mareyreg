"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { MobileListCard } from "@/components/ui/mobile-list-card";
import { ResponsiveListView } from "@/components/ui/responsive-list-view";
import { Fab } from "@/components/ui/fab";
import { MetricTile } from "@/components/ui/metric-tile";
import { StatusPill } from "@/components/ui/status-pill";
import { MobileFilterSheet } from "@/components/ui/mobile-filter-sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FormDialogHeader } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import { type DataTableColumn } from "@/components/ui/data-table";
import {
  Wallet, Plus, Search, MoreHorizontal, SquarePen, Trash2, Loader2,
  Hash, Type, Users, CircleDollarSign, Calculator, ToggleLeft, MinusCircle,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import {
  createAccount, updateAccount, toggleAccountActive, deleteAccount,
} from "../../actions/account-actions";
import type { AccountRow } from "../../lib/types";
import { CurrencyChip } from "../shared/currency-chip";
import { AmountDisplay } from "../shared/amount-display";
import {
  AccountRuleMenuItems,
  AccountRuleDialogs,
  type RuleActionState,
  type RuleActionMode,
  type RuleSummary,
} from "./account-rule-actions";

type GroupOption = { groupId: number; code: string; name: string; userId: number };
type CurrencyOption = { currencyId: number; code: string; symbol: string; decimalPlaces: number };
type RuleOption = RuleSummary & {
  baseCurrency: { code: string };
  quoteCurrency: { code: string };
};

interface Props {
  initialAccounts: AccountRow[];
  groups: GroupOption[];
  currencies: CurrencyOption[];
  rules: RuleOption[];
  assignedByAccount?: Record<number, RuleSummary[]>;
}

export function AccountListClient({
  initialAccounts,
  groups,
  currencies,
  rules,
  assignedByAccount = {},
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterGroup, setFilterGroup] = useState<string>("");
  const [filterCurrency, setFilterCurrency] = useState<string>("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toEdit, setToEdit] = useState<AccountRow | null>(null);
  const [toDelete, setToDelete] = useState<AccountRow | null>(null);
  const [ruleAction, setRuleAction] = useState<RuleActionState>(null);
  const [submitting, setSubmitting] = useState(false);

  const [groupId, setGroupId] = useState<string>("");
  const [currencyId, setCurrencyId] = useState<string>("");
  const [accountNumber, setAccountNumber] = useState("");
  const [name, setName] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [allowNegativeBalance, setAllowNegativeBalance] = useState(false);

  const filtered = useMemo(() => {
    let rows = initialAccounts;
    if (filterGroup) rows = rows.filter((a) => String(a.groupId) === filterGroup);
    if (filterCurrency) rows = rows.filter((a) => String(a.currencyId) === filterCurrency);
    const q = search.toLowerCase().trim();
    if (q) {
      rows = rows.filter(
        (a) =>
          a.accountNumber.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          a.groupName.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [initialAccounts, search, filterGroup, filterCurrency]);

  const totalActive = initialAccounts.filter((a) => a.active).length;
  const balancesByCurrency = useMemo(() => {
    const map = new Map<string, { code: string; total: number; decimalPlaces: number }>();
    for (const a of initialAccounts) {
      if (!a.active) continue;
      const prev = map.get(a.currencyCode);
      if (prev) prev.total += a.balance;
      else map.set(a.currencyCode, { code: a.currencyCode, total: a.balance, decimalPlaces: a.currencyDecimals });
    }
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [initialAccounts]);

  const handleRuleAction = (a: AccountRow, mode: RuleActionMode) => {
    setRuleAction({ account: a, mode });
  };

  const resetForm = () => {
    setGroupId("");
    setCurrencyId("");
    setAccountNumber("");
    setName("");
    setOpeningBalance("0");
    setAllowNegativeBalance(false);
  };

  const fillEdit = (a: AccountRow) => {
    setGroupId(String(a.groupId));
    setCurrencyId(String(a.currencyId));
    setAccountNumber(a.accountNumber);
    setName(a.name);
    setOpeningBalance(String(a.balance));
    setAllowNegativeBalance(a.allowNegativeBalance);
    setToEdit(a);
  };

  // Auto-suggest accountNumber al elegir grupo + moneda
  const onPickGroupOrCurrency = (gId: string, cId: string) => {
    if (toEdit) return;
    if (gId && cId && !accountNumber.trim()) {
      const g = groups.find((x) => String(x.groupId) === gId);
      const c = currencies.find((x) => String(x.currencyId) === cId);
      if (g && c) setAccountNumber(`${g.code}-${c.code}`);
    }
  };

  const validate = () => {
    if (!groupId) return "Selecciona un grupo";
    if (!currencyId) return "Selecciona una moneda";
    if (!accountNumber.trim()) return "Número de cuenta requerido";
    if (!/^[A-Z0-9_-]+$/.test(accountNumber.trim().toUpperCase())) return "Número solo mayúsculas, números, _ y -";
    if (!name.trim()) return "Nombre requerido";
    if (!Number.isFinite(Number(openingBalance))) return "Saldo inicial inválido";
    return null;
  };

  const handleCreate = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSubmitting(true);
    const r = await createAccount({
      groupId: Number(groupId),
      currencyId: Number(currencyId),
      accountNumber: accountNumber.trim().toUpperCase(),
      name: name.trim(),
      openingBalance: Number(openingBalance) || 0,
      allowNegativeBalance,
    });
    setSubmitting(false);
    if (r.success) {
      toast.success("Cuenta creada");
      setIsCreateOpen(false); resetForm(); router.refresh();
    } else toast.error(r.error);
  };

  const handleUpdate = async () => {
    if (!toEdit) return;
    if (!name.trim()) { toast.error("Nombre requerido"); return; }
    setSubmitting(true);
    const r = await updateAccount(toEdit.accountId, {
      name: name.trim(),
      accountNumber: accountNumber.trim().toUpperCase(),
      allowNegativeBalance,
    });
    setSubmitting(false);
    if (r.success) {
      toast.success("Cuenta actualizada");
      setToEdit(null); resetForm(); router.refresh();
    } else toast.error(r.error);
  };

  const handleToggle = async (a: AccountRow) => {
    const r = await toggleAccountActive(a.accountId);
    if (r.success) {
      toast.success(r.data.active ? "Cuenta activada" : "Cuenta desactivada");
      router.refresh();
    } else toast.error(r.error);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setSubmitting(true);
    const r = await deleteAccount(toDelete.accountId);
    setSubmitting(false);
    if (r.success) {
      toast.success("Cuenta eliminada");
      setToDelete(null); router.refresh();
    } else toast.error(r.error);
  };

  const columns: DataTableColumn<AccountRow>[] = [
    {
      key: "account",
      header: "Cuenta",
      cell: (a) => (
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-medium text-foreground truncate flex items-center gap-2">
            <CurrencyChip code={a.currencyCode} size="sm" />
            {a.name}
          </span>
          <span className="text-[11px] font-mono tabular-nums text-muted-foreground">{a.accountNumber}</span>
        </div>
      ),
    },
    {
      key: "group",
      header: "Grupo",
      cell: (a) => <span className="text-sm">{a.groupName}</span>,
    },
    {
      key: "balance",
      header: "Saldo",
      align: "right",
      cell: (a) => <AmountDisplay value={a.balance} decimalPlaces={a.currencyDecimals} signed />,
    },
    {
      key: "rule",
      header: "Reglas",
      cell: (a) => (
        <div className="flex items-center gap-1.5 flex-wrap">
          {a.rulesCount > 0 ? (
            <Badge variant="outline" className="text-[10px]">
              {a.rulesCount} {a.rulesCount === 1 ? "regla" : "reglas"}
            </Badge>
          ) : null}
          {a.allowNegativeBalance ? (
            <Badge variant="warning" className="text-[10px] gap-1">
              <MinusCircle className="h-3 w-3" />
              Negativo OK
            </Badge>
          ) : null}
          {a.rulesCount === 0 && !a.allowNegativeBalance ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "status",
      header: "Estado",
      align: "right",
      cell: (a) => <StatusPill status={a.active ? "active" : "inactive"} size="sm" />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "w-12",
      cell: (a) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setTimeout(() => router.push(`/envios/cuentas/${a.accountId}`), 0);
              }}
            >
              <Eye className="h-4 w-4" /> Ver detalles
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setTimeout(() => fillEdit(a), 0);
              }}
            >
              <SquarePen className="h-4 w-4" /> Editar cuenta
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setTimeout(() => void handleToggle(a), 0);
              }}
            >
              <ToggleLeft className="h-4 w-4" /> {a.active ? "Desactivar" : "Activar"}
            </DropdownMenuItem>
            <AccountRuleMenuItems
              account={a}
              onAction={(mode) => handleRuleAction(a, mode)}
            />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setTimeout(() => setToDelete(a), 0);
              }}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Wallet}
        title="Cuentas"
        description="Una cuenta por moneda dentro de cada grupo. El saldo cambia con depósitos, retiros y transferencias confirmadas."
        badge={`${initialAccounts.length} cuentas`}
        actions={
          <Button
            variant="brand"
            onClick={() => { resetForm(); setIsCreateOpen(true); }}
            className="hidden md:inline-flex"
          >
            <Plus className="h-4 w-4" /> Nueva cuenta
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <MetricTile label="Cuentas activas" value={totalActive} icon={Wallet} tone="active" />
        {balancesByCurrency.slice(0, 3).map((b) => (
          <MetricTile
            key={b.code}
            label={`Saldo ${b.code}`}
            value={b.total.toLocaleString("es-MX", {
              minimumFractionDigits: b.decimalPlaces,
              maximumFractionDigits: b.decimalPlaces,
            })}
            icon={CircleDollarSign}
            tone="track"
          />
        ))}
      </div>

      <ResponsiveListView<AccountRow>
        columns={columns}
        rows={filtered}
        rowKey={(a) => a.accountId}
        onRowClick={(a) => router.push(`/envios/cuentas/${a.accountId}`)}
        mobileCard={(a) => (
          <MobileListCard
            key={a.accountId}
            onClick={() => router.push(`/envios/cuentas/${a.accountId}`)}
            title={
              <span className="flex items-center gap-2">
                <CurrencyChip code={a.currencyCode} size="sm" />
                <span className="truncate font-medium">{a.name}</span>
              </span>
            }
            subtitle={`${a.groupName} · ${a.accountNumber}`}
            value={
              <AmountDisplay value={a.balance} decimalPlaces={a.currencyDecimals} signed />
            }
            actions={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-10" onClick={(e) => e.stopPropagation()} aria-label={`Acciones de la cuenta ${a.name}`}>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setTimeout(() => router.push(`/envios/cuentas/${a.accountId}`), 0);
                    }}
                  >
                    <Eye className="h-4 w-4" /> Ver detalles
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setTimeout(() => fillEdit(a), 0);
                    }}
                  >
                    <SquarePen className="h-4 w-4" /> Editar cuenta
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setTimeout(() => void handleToggle(a), 0);
                    }}
                  >
                    <ToggleLeft className="h-4 w-4" /> {a.active ? "Desactivar" : "Activar"}
                  </DropdownMenuItem>
                  <AccountRuleMenuItems
                    account={a}
                    onAction={(mode) => handleRuleAction(a, mode)}
                  />
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setTimeout(() => setToDelete(a), 0);
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" /> Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
            meta={
              <div className="flex items-center gap-2 flex-wrap">
                <StatusPill status={a.active ? "active" : "inactive"} size="sm" />
                {a.rulesCount > 0 ? (
                  <Badge variant="outline" className="text-[10px]">
                    {a.rulesCount} {a.rulesCount === 1 ? "regla" : "reglas"}
                  </Badge>
                ) : null}
              </div>
            }
          />
        )}
        toolbar={
          <div className="flex w-full items-center gap-2 flex-1 min-w-0">
            <InputGroup className="flex-1 min-w-0 sm:min-w-[180px] sm:max-w-md">
              <InputGroupAddon><Search /></InputGroupAddon>
              <InputGroupInput
                placeholder="Buscar cuenta, grupo, número…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <InputGroupAddon align="inline-end">
                <Badge variant="brand">{filtered.length}</Badge>
              </InputGroupAddon>
            </InputGroup>
            <div className="hidden sm:flex sm:items-center sm:gap-2">
              <Select value={filterGroup || "all"} onValueChange={(v) => setFilterGroup(v === "all" ? "" : v)}>
                <SelectTrigger className="min-w-[140px] w-auto">
                  <SelectValue placeholder="Grupo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los grupos</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.groupId} value={String(g.groupId)}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterCurrency || "all"} onValueChange={(v) => setFilterCurrency(v === "all" ? "" : v)}>
                <SelectTrigger className="min-w-[110px] w-auto">
                  <SelectValue placeholder="Moneda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {currencies.map((c) => (
                    <SelectItem key={c.currencyId} value={String(c.currencyId)}>{c.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:hidden">
              <MobileFilterSheet
                activeCount={(filterGroup ? 1 : 0) + (filterCurrency ? 1 : 0)}
                onClear={() => { setFilterGroup(""); setFilterCurrency(""); }}
              >
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Grupo</label>
                  <Select value={filterGroup || "all"} onValueChange={(v) => setFilterGroup(v === "all" ? "" : v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los grupos</SelectItem>
                      {groups.map((g) => (
                        <SelectItem key={g.groupId} value={String(g.groupId)}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Moneda</label>
                  <Select value={filterCurrency || "all"} onValueChange={(v) => setFilterCurrency(v === "all" ? "" : v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Moneda" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {currencies.map((c) => (
                        <SelectItem key={c.currencyId} value={String(c.currencyId)}>{c.code}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </MobileFilterSheet>
            </div>
          </div>
        }
        emptyState={
          <EmptyState
            title="Sin cuentas"
            description={
              search || filterGroup || filterCurrency
                ? "No hay coincidencias con los filtros."
                : groups.length === 0
                  ? "Primero crea un grupo. Cada grupo agrupa cuentas multi-moneda."
                  : "Agrega una cuenta por cada moneda que maneje cada grupo."
            }
          >
            {!(search || filterGroup || filterCurrency) ? (
              groups.length === 0 ? (
                <Button variant="brand" asChild>
                  <Link href="/envios/grupos">
                    <Users className="h-4 w-4" /> Ir a grupos
                  </Link>
                </Button>
              ) : (
                <Button
                  variant="brand"
                  onClick={() => { resetForm(); setIsCreateOpen(true); }}
                >
                  <Plus className="h-4 w-4" /> Crear primera cuenta
                </Button>
              )
            ) : null}
          </EmptyState>
        }
      />

      <ResponsiveFormDialog
        open={isCreateOpen || !!toEdit}
        onOpenChange={(o) => {
          if (!o) {
            setIsCreateOpen(false); setToEdit(null); resetForm();
          }
        }}
        a11yTitle={toEdit ? "Editar cuenta" : "Nueva cuenta"}
        description="Cuenta operativa dentro de un grupo, con una moneda y una regla de tasa opcional."
        desktopMaxWidth="sm:max-w-lg"
      >
        <FormDialogHeader
          icon={Wallet}
          title={toEdit ? "Editar cuenta" : "Nueva cuenta"}
          description="Cuenta operativa dentro de un grupo, con una moneda y una regla de tasa opcional."
        />
        <div className="space-y-4 mt-4">
          <FormSection icon={Wallet} title="Identificación">
            <Field label="Grupo" icon={Users} required>
              <Select
                value={groupId}
                onValueChange={(v) => { setGroupId(v); onPickGroupOrCurrency(v, currencyId); }}
                disabled={!!toEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un grupo" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.groupId} value={String(g.groupId)}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Moneda" icon={CircleDollarSign} required>
              <Select
                value={currencyId}
                onValueChange={(v) => { setCurrencyId(v); onPickGroupOrCurrency(groupId, v); }}
                disabled={!!toEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una moneda" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.currencyId} value={String(c.currencyId)}>
                      {c.code} · {c.symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Número de cuenta" icon={Hash} required hint="Mayúsculas, números, _ y -. Se autosugiere desde grupo + moneda.">
              <Input
                placeholder="ALEJANDRO_STGO-USD"
                value={accountNumber}
                maxLength={40}
                onChange={(e) => setAccountNumber(e.target.value.toUpperCase())}
              />
            </Field>
            <Field label="Nombre" icon={Type} required>
              <Input
                placeholder="Cuenta principal USD"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            {!toEdit && (
              <Field label="Saldo inicial" icon={CircleDollarSign} hint="Crea una operación de ajuste con este monto. Permitido negativo si la cuenta lo soporta.">
                <Input
                  type="number"
                  step="0.00000001"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                />
              </Field>
            )}
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
          <Button
            type="button"
            variant="outline"
            onClick={() => { setIsCreateOpen(false); setToEdit(null); resetForm(); }}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="brand"
            onClick={toEdit ? handleUpdate : handleCreate}
            disabled={submitting}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Guardando…" : toEdit ? "Actualizar" : "Crear"}
          </Button>
        </div>
      </ResponsiveFormDialog>

      <AlertDialog open={!!toDelete} onOpenChange={() => setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cuenta?</AlertDialogTitle>
            <AlertDialogDescription>
              Si tiene operaciones registradas, no podrá eliminarse. Desactívala en su lugar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={submitting}
            >
              {submitting ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AccountRuleDialogs
        state={ruleAction}
        onClose={() => setRuleAction(null)}
        rules={rules}
        assignedByAccount={assignedByAccount}
        currencies={currencies}
      />

      <Fab icon={Plus} label="Nueva cuenta" onClick={() => { resetForm(); setIsCreateOpen(true); }} />
    </div>
  );
}
