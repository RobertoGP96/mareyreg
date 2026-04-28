"use client";

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
  CircleDollarSign, Plus, Search, MoreHorizontal, SquarePen, Trash2, Loader2,
  Hash, Type, Calculator, ToggleLeft,
} from "lucide-react";
import { toast } from "sonner";
import {
  createCurrency, updateCurrency, toggleCurrency, deleteCurrency,
} from "../../actions/currency-actions";
import type { CurrencyRow } from "../../lib/types";
import { CurrencyChip } from "../shared/currency-chip";

interface Props {
  initialCurrencies: CurrencyRow[];
}

export function CurrencyListClient({ initialCurrencies }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toEdit, setToEdit] = useState<CurrencyRow | null>(null);
  const [toDelete, setToDelete] = useState<CurrencyRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [decimalPlaces, setDecimalPlaces] = useState("2");
  const [active, setActive] = useState(true);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return initialCurrencies;
    return initialCurrencies.filter(
      (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    );
  }, [initialCurrencies, search]);

  const totalActive = initialCurrencies.filter((c) => c.active).length;
  const totalAccounts = initialCurrencies.reduce((acc, c) => acc + c.accountsCount, 0);
  const totalRules = initialCurrencies.reduce((acc, c) => acc + c.rulesCount, 0);

  const resetForm = () => {
    setCode(""); setName(""); setSymbol(""); setDecimalPlaces("2"); setActive(true);
  };
  const fillEdit = (c: CurrencyRow) => {
    setCode(c.code); setName(c.name); setSymbol(c.symbol);
    setDecimalPlaces(String(c.decimalPlaces)); setActive(c.active);
    setToEdit(c);
  };

  const validate = () => {
    if (!code.trim()) return "El código es requerido";
    if (!/^[A-Z0-9]+$/.test(code.trim().toUpperCase())) return "Código solo mayúsculas y números";
    if (!name.trim()) return "El nombre es requerido";
    if (!symbol.trim()) return "El símbolo es requerido";
    const dp = Number(decimalPlaces);
    if (!Number.isFinite(dp) || dp < 0 || dp > 8) return "Decimales 0-8";
    return null;
  };

  const handleCreate = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSubmitting(true);
    const r = await createCurrency({
      code: code.trim().toUpperCase(),
      name: name.trim(),
      symbol: symbol.trim(),
      decimalPlaces: Number(decimalPlaces),
      active,
    });
    setSubmitting(false);
    if (r.success) {
      toast.success("Moneda creada");
      setIsCreateOpen(false); resetForm(); router.refresh();
    } else toast.error(r.error);
  };

  const handleUpdate = async () => {
    if (!toEdit) return;
    const err = validate();
    if (err) { toast.error(err); return; }
    setSubmitting(true);
    const r = await updateCurrency(toEdit.currencyId, {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      symbol: symbol.trim(),
      decimalPlaces: Number(decimalPlaces),
      active,
    });
    setSubmitting(false);
    if (r.success) {
      toast.success("Moneda actualizada");
      setToEdit(null); resetForm(); router.refresh();
    } else toast.error(r.error);
  };

  const handleToggle = async (c: CurrencyRow) => {
    const r = await toggleCurrency(c.currencyId);
    if (r.success) {
      toast.success(r.data.active ? "Moneda activada" : "Moneda desactivada");
      router.refresh();
    } else toast.error(r.error);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setSubmitting(true);
    const r = await deleteCurrency(toDelete.currencyId);
    setSubmitting(false);
    if (r.success) {
      toast.success("Moneda eliminada");
      setToDelete(null); router.refresh();
    } else toast.error(r.error);
  };

  const columns: DataTableColumn<CurrencyRow>[] = [
    {
      key: "code",
      header: "Código",
      cell: (c) => <CurrencyChip code={c.code} size="md" />,
    },
    {
      key: "name",
      header: "Nombre",
      cell: (c) => <span className="font-medium text-foreground truncate">{c.name}</span>,
    },
    {
      key: "symbol",
      header: "Símbolo",
      align: "right",
      cell: (c) => <span className="font-mono tabular-nums text-sm">{c.symbol}</span>,
    },
    {
      key: "decimals",
      header: "Decimales",
      align: "right",
      cell: (c) => <span className="font-mono tabular-nums text-xs text-muted-foreground">{c.decimalPlaces}</span>,
    },
    {
      key: "accounts",
      header: "Cuentas",
      align: "right",
      cell: (c) =>
        c.accountsCount > 0 ? <Badge variant="brand">{c.accountsCount}</Badge> : <Badge variant="outline">0</Badge>,
    },
    {
      key: "status",
      header: "Estado",
      align: "right",
      cell: (c) => <StatusPill status={c.active ? "active" : "inactive"} size="sm" />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "w-12",
      cell: (c) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => fillEdit(c)}>
              <SquarePen className="h-4 w-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleToggle(c)}>
              <ToggleLeft className="h-4 w-4" /> {c.active ? "Desactivar" : "Activar"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setToDelete(c)}
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
        icon={CircleDollarSign}
        title="Monedas"
        description="Catálogo de divisas con código, símbolo y precisión decimal."
        badge={`${initialCurrencies.length} monedas`}
      >
        <Button
          variant="brand"
          onClick={() => { resetForm(); setIsCreateOpen(true); }}
          className="hidden md:inline-flex"
        >
          <Plus className="h-4 w-4" /> Nueva moneda
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <MetricTile label="Activas" value={totalActive} icon={CircleDollarSign} tone="active" />
        <MetricTile label="Cuentas usando" value={totalAccounts} icon={Hash} tone="track" />
        <MetricTile label="Reglas de tasa" value={totalRules} icon={Calculator} tone="success" />
      </div>

      <ResponsiveListView<CurrencyRow>
        columns={columns}
        rows={filtered}
        rowKey={(c) => c.currencyId}
        mobileCard={(c) => (
          <MobileListCard
            key={c.currencyId}
            title={
              <span className="flex items-center gap-2">
                <CurrencyChip code={c.code} size="sm" />
                <span className="font-medium truncate">{c.name}</span>
              </span>
            }
            subtitle={`${c.symbol} · ${c.decimalPlaces} dec.`}
            value={<StatusPill status={c.active ? "active" : "inactive"} size="sm" />}
            actions={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-9">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => fillEdit(c)}>
                    <SquarePen className="h-4 w-4" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleToggle(c)}>
                    <ToggleLeft className="h-4 w-4" /> {c.active ? "Desactivar" : "Activar"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setToDelete(c)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" /> Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
            meta={
              c.accountsCount > 0 ? (
                <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                  {c.accountsCount} cuenta(s)
                </span>
              ) : null
            }
          />
        )}
        toolbar={
          <InputGroup className="flex-1 min-w-[180px] max-w-md">
            <InputGroupAddon><Search /></InputGroupAddon>
            <InputGroupInput
              placeholder="Buscar código o nombre…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <InputGroupAddon align="inline-end">
              <Badge variant="brand">{filtered.length}</Badge>
            </InputGroupAddon>
          </InputGroup>
        }
        emptyState={
          <EmptyState
            title="Sin monedas"
            description={search ? "No hay coincidencias." : "Agrega monedas para empezar a operar."}
          />
        }
      />

      <ResponsiveFormDialog
        open={isCreateOpen || !!toEdit}
        onOpenChange={(o) => {
          if (!o) {
            setIsCreateOpen(false); setToEdit(null); resetForm();
          }
        }}
        a11yTitle={toEdit ? "Editar moneda" : "Nueva moneda"}
        description="Define el código ISO, nombre comercial, símbolo y precisión decimal."
        desktopMaxWidth="sm:max-w-lg"
      >
        <FormDialogHeader
          icon={CircleDollarSign}
          title={toEdit ? "Editar moneda" : "Nueva moneda"}
          description="Define el código ISO, nombre comercial, símbolo y precisión decimal."
        />
        <div className="space-y-4 mt-4">
          <FormSection icon={CircleDollarSign} title="Identificación">
            <Field label="Código" icon={Hash} required hint="Mayúsculas, 2-8 caracteres (ej. USD, USDT, CUP).">
              <Input
                placeholder="USD"
                value={code}
                maxLength={8}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            </Field>
            <Field label="Nombre" icon={Type} required>
              <Input
                placeholder="Dólar estadounidense"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Símbolo" icon={CircleDollarSign} required hint="Cómo se muestra en montos (ej. $, ₮, €).">
              <Input
                placeholder="$"
                value={symbol}
                maxLength={8}
                onChange={(e) => setSymbol(e.target.value)}
              />
            </Field>
            <Field label="Decimales" icon={Calculator} hint="Número de decimales para mostrar (0-8).">
              <Input
                type="number"
                min={0}
                max={8}
                step={1}
                value={decimalPlaces}
                onChange={(e) => setDecimalPlaces(e.target.value)}
              />
            </Field>
            <Field label="Activa" icon={ToggleLeft} hint="Si está inactiva no aparece en formularios nuevos.">
              <div className="flex items-center gap-3">
                <Switch checked={active} onCheckedChange={setActive} />
                <span className="text-sm text-muted-foreground">{active ? "Sí" : "No"}</span>
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
            <AlertDialogTitle>¿Eliminar moneda?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.accountsCount
                ? `${toDelete.accountsCount} cuenta(s) usan "${toDelete.code}" y bloquean la eliminación. Desactívala en su lugar.`
                : `Se eliminará la moneda "${toDelete?.code}".`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={submitting || (toDelete?.accountsCount ?? 0) > 0}
            >
              {submitting ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Fab
        icon={Plus}
        label="Nueva moneda"
        onClick={() => { resetForm(); setIsCreateOpen(true); }}
      />
    </div>
  );
}
