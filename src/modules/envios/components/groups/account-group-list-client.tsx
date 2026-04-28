"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Users, Plus, Search, MoreHorizontal, SquarePen, Trash2, Loader2, Eye,
  Hash, Type, FileText, ToggleLeft, UserCircle, Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  createAccountGroup, updateAccountGroup, toggleAccountGroup, deleteAccountGroup,
} from "../../actions/account-group-actions";
import type { AccountGroupRow } from "../../lib/types";
import { CurrencyChip } from "../shared/currency-chip";
import { AmountDisplay } from "../shared/amount-display";

type AssignableUser = {
  userId: number;
  fullName: string;
  email: string;
  role: string;
};

interface Props {
  initialGroups: AccountGroupRow[];
  users: AssignableUser[];
}

export function AccountGroupListClient({ initialGroups, users }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toEdit, setToEdit] = useState<AccountGroupRow | null>(null);
  const [toDelete, setToDelete] = useState<AccountGroupRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [userId, setUserId] = useState<string>("");
  const [active, setActive] = useState(true);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return initialGroups;
    return initialGroups.filter(
      (g) =>
        g.code.toLowerCase().includes(q) ||
        g.name.toLowerCase().includes(q) ||
        (g.description?.toLowerCase().includes(q) ?? false) ||
        (g.ownerName?.toLowerCase().includes(q) ?? false)
    );
  }, [initialGroups, search]);

  const totalActive = initialGroups.filter((g) => g.active).length;
  const totalAccounts = initialGroups.reduce((acc, g) => acc + g.accountsCount, 0);

  const resetForm = () => {
    setCode(""); setName(""); setDescription(""); setUserId(""); setActive(true);
  };
  const fillEdit = (g: AccountGroupRow) => {
    setCode(g.code); setName(g.name); setDescription(g.description ?? "");
    // userId no viene del row directamente — fetch from edit handler vía formulario; resolver con users[].
    const owner = users.find((u) => u.email === g.ownerEmail);
    setUserId(owner ? String(owner.userId) : "");
    setActive(g.active);
    setToEdit(g);
  };

  const validate = () => {
    if (!code.trim()) return "El código es requerido";
    if (!/^[A-Z0-9_]+$/.test(code.trim().toUpperCase())) return "Código solo mayúsculas, números y _";
    if (!name.trim()) return "El nombre es requerido";
    if (!userId) return "Selecciona un responsable";
    return null;
  };

  const handleCreate = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSubmitting(true);
    const r = await createAccountGroup({
      code: code.trim().toUpperCase(),
      name: name.trim(),
      description: description.trim() || null,
      userId: Number(userId),
      active,
    });
    setSubmitting(false);
    if (r.success) {
      toast.success("Grupo creado");
      setIsCreateOpen(false); resetForm(); router.refresh();
    } else toast.error(r.error);
  };

  const handleUpdate = async () => {
    if (!toEdit) return;
    const err = validate();
    if (err) { toast.error(err); return; }
    setSubmitting(true);
    const r = await updateAccountGroup(toEdit.groupId, {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      description: description.trim() || null,
      userId: Number(userId),
      active,
    });
    setSubmitting(false);
    if (r.success) {
      toast.success("Grupo actualizado");
      setToEdit(null); resetForm(); router.refresh();
    } else toast.error(r.error);
  };

  const handleToggle = async (g: AccountGroupRow) => {
    const r = await toggleAccountGroup(g.groupId);
    if (r.success) {
      toast.success(r.data.active ? "Grupo activado" : "Grupo desactivado");
      router.refresh();
    } else toast.error(r.error);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setSubmitting(true);
    const r = await deleteAccountGroup(toDelete.groupId);
    setSubmitting(false);
    if (r.success) {
      toast.success("Grupo eliminado");
      setToDelete(null); router.refresh();
    } else toast.error(r.error);
  };

  const renderBalances = (g: AccountGroupRow) => {
    if (!g.balancesByCurrency.length) {
      return <span className="text-xs text-muted-foreground">Sin saldos</span>;
    }
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {g.balancesByCurrency.map((b) => (
          <span
            key={b.currencyId}
            className="inline-flex items-center gap-1 rounded-md bg-muted/40 px-1.5 py-0.5 ring-1 ring-inset ring-border"
          >
            <CurrencyChip code={b.code} size="sm" />
            <AmountDisplay value={b.balance} decimalPlaces={b.decimalPlaces} signed size="sm" />
          </span>
        ))}
      </div>
    );
  };

  const columns: DataTableColumn<AccountGroupRow>[] = [
    {
      key: "name",
      header: "Grupo",
      cell: (g) => (
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-medium text-foreground truncate flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground shrink-0" />
            {g.name}
          </span>
          <span className="text-[11px] font-mono tabular-nums text-muted-foreground">{g.code}</span>
        </div>
      ),
    },
    {
      key: "owner",
      header: "Responsable",
      cell: (g) => (
        <span className="text-sm flex items-center gap-1.5 min-w-0">
          <UserCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">{g.ownerName ?? g.ownerEmail ?? "—"}</span>
        </span>
      ),
    },
    {
      key: "balances",
      header: "Saldos",
      cell: renderBalances,
    },
    {
      key: "accounts",
      header: "Cuentas",
      align: "right",
      cell: (g) =>
        g.accountsCount > 0 ? (
          <Badge variant="brand">{g.accountsCount}</Badge>
        ) : (
          <Badge variant="outline">0</Badge>
        ),
    },
    {
      key: "status",
      header: "Estado",
      align: "right",
      cell: (g) => <StatusPill status={g.active ? "active" : "inactive"} size="sm" />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "w-12",
      cell: (g) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => router.push(`/envios/grupos/${g.groupId}`)}>
              <Eye className="h-4 w-4" /> Ver detalles
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => fillEdit(g)}>
              <SquarePen className="h-4 w-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleToggle(g)}>
              <ToggleLeft className="h-4 w-4" /> {g.active ? "Desactivar" : "Activar"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setToDelete(g)}
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
        icon={Users}
        title="Grupos"
        description="Cada grupo agrupa cuentas multi-moneda por persona o tarea (equivalente a una hoja del Excel)."
        badge={`${initialGroups.length} grupos`}
      >
        <Button
          variant="brand"
          onClick={() => { resetForm(); setIsCreateOpen(true); }}
          className="hidden md:inline-flex"
        >
          <Plus className="h-4 w-4" /> Nuevo grupo
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <MetricTile label="Activos" value={totalActive} icon={Users} tone="active" />
        <MetricTile label="Cuentas totales" value={totalAccounts} icon={Wallet} tone="track" />
        <MetricTile
          label="Sin cuentas"
          value={initialGroups.filter((g) => g.accountsCount === 0).length}
          icon={Wallet}
          tone="warning"
        />
      </div>

      <ResponsiveListView<AccountGroupRow>
        columns={columns}
        rows={filtered}
        rowKey={(g) => g.groupId}
        onRowClick={(g) => router.push(`/envios/grupos/${g.groupId}`)}
        mobileCard={(g) => (
          <MobileListCard
            key={g.groupId}
            onClick={() => router.push(`/envios/grupos/${g.groupId}`)}
            title={
              <span className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate font-medium">{g.name}</span>
              </span>
            }
            subtitle={`${g.code} · ${g.ownerName ?? "—"}`}
            value={<StatusPill status={g.active ? "active" : "inactive"} size="sm" />}
            actions={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-9">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => router.push(`/envios/grupos/${g.groupId}`)}>
                    <Eye className="h-4 w-4" /> Ver detalles
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => fillEdit(g)}>
                    <SquarePen className="h-4 w-4" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleToggle(g)}>
                    <ToggleLeft className="h-4 w-4" /> {g.active ? "Desactivar" : "Activar"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setToDelete(g)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" /> Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
            meta={renderBalances(g)}
          />
        )}
        toolbar={
          <InputGroup className="flex-1 min-w-[180px] max-w-md">
            <InputGroupAddon><Search /></InputGroupAddon>
            <InputGroupInput
              placeholder="Buscar nombre, código, responsable…"
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
            title="Sin grupos aún"
            description={
              search
                ? "No hay coincidencias con la búsqueda."
                : "Cada grupo es como una hoja de tu Excel — agrupa cuentas por persona o tarea."
            }
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
        a11yTitle={toEdit ? "Editar grupo" : "Nuevo grupo"}
        description="Identificador único, nombre visible y responsable del grupo."
        desktopMaxWidth="sm:max-w-lg"
      >
        <FormDialogHeader
          icon={Users}
          title={toEdit ? "Editar grupo" : "Nuevo grupo"}
          description="Identificador único, nombre visible y responsable del grupo."
        />
        <div className="space-y-4 mt-4">
          <FormSection icon={Users} title="Datos del grupo">
            <Field label="Código" icon={Hash} required hint="Mayúsculas, números y guion bajo (ej. ALEJANDRO_STGO).">
              <Input
                placeholder="ALEJANDRO_STGO"
                value={code}
                maxLength={40}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            </Field>
            <Field label="Nombre" icon={Type} required>
              <Input
                placeholder="G. Alejandro Santiago"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Responsable" icon={UserCircle} required hint="Usuario dueño del grupo.">
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un responsable" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.userId} value={String(u.userId)}>
                      {u.fullName}{u.role !== "viewer" ? ` · ${u.role}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Descripción" icon={FileText}>
              <Textarea
                rows={2}
                placeholder="Notas opcionales"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <Field label="Activo" icon={ToggleLeft}>
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
            <AlertDialogTitle>¿Eliminar grupo?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.accountsCount
                ? `${toDelete.accountsCount} cuenta(s) en "${toDelete.name}" bloquean la eliminación. Desactívalo en su lugar.`
                : `Se eliminará el grupo "${toDelete?.name}".`}
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
        label="Nuevo grupo"
        onClick={() => { resetForm(); setIsCreateOpen(true); }}
      />
    </div>
  );
}
