"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { MobileListCard } from "@/components/ui/mobile-list-card";
import { ResponsiveListView } from "@/components/ui/responsive-list-view";
import { Fab } from "@/components/ui/fab";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormDialogHeader } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import { type DataTableColumn } from "@/components/ui/data-table";
import { MetricTile } from "@/components/ui/metric-tile";
import { StatusPill } from "@/components/ui/status-pill";
import {
  Plus,
  Search,
  SquarePen,
  Trash2,
  UserRound,
  Phone,
  Mail,
  Loader2,
  MoreHorizontal,
  Users,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import {
  createPacaClient,
  updatePacaClient,
  deletePacaClient,
  deletePacaClients,
  type PacaClientInput,
} from "../actions/paca-client-actions";

interface PacaClientItem {
  clientId: number;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  isActive: boolean;
}

export function PacaClientListClient({ clients }: { clients: PacaClientItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toEdit, setToEdit] = useState<PacaClientItem | null>(null);
  const [toDelete, setToDelete] = useState<PacaClientItem | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<Set<string | number>>(new Set());

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone?.toLowerCase().includes(q) ?? false) ||
        (c.email?.toLowerCase().includes(q) ?? false)
    );
  }, [clients, search]);

  const activeCount = clients.filter((c) => c.isActive).length;
  const inactiveCount = clients.length - activeCount;
  const withEmail = clients.filter((c) => !!c.email).length;
  const withPhone = clients.filter((c) => !!c.phone).length;

  const resetForm = () => {
    setName("");
    setPhone("");
    setEmail("");
    setNotes("");
  };

  const fillEdit = (c: PacaClientItem) => {
    setName(c.name);
    setPhone(c.phone ?? "");
    setEmail(c.email ?? "");
    setNotes(c.notes ?? "");
    setToEdit(c);
  };

  const buildInput = (): PacaClientInput => ({
    name,
    phone: phone || undefined,
    email: email || undefined,
    notes: notes || undefined,
  });

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    setSubmitting(true);
    const r = await createPacaClient(buildInput());
    setSubmitting(false);
    if (r.success) {
      setIsCreateOpen(false);
      toast.success("Cliente creado");
      resetForm();
      router.refresh();
    } else toast.error(r.error);
  };

  const handleUpdate = async () => {
    if (!toEdit) return;
    if (!name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    setSubmitting(true);
    const r = await updatePacaClient(toEdit.clientId, buildInput());
    setSubmitting(false);
    if (r.success) {
      setToEdit(null);
      toast.success("Cliente actualizado");
      resetForm();
      router.refresh();
    } else toast.error(r.error);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setSubmitting(true);
    const r = await deletePacaClient(toDelete.clientId);
    setSubmitting(false);
    if (r.success) {
      setToDelete(null);
      toast.success("Cliente desactivado");
      router.refresh();
    } else toast.error(r.error);
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    const ids = Array.from(selected).map((k) => Number(k));
    const r = await deletePacaClients(ids);
    setSubmitting(false);
    if (r.success) {
      toast.success(`${r.data.deleted} cliente(s) desactivado(s)`);
      setSelected(new Set());
      setBulkDeleteOpen(false);
      router.refresh();
    } else toast.error(r.error);
  };

  const columns: DataTableColumn<PacaClientItem>[] = [
    {
      key: "name",
      header: "Cliente",
      cell: (c) => (
        <div className="flex items-center gap-2 min-w-0">
          <UserRound className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium text-foreground truncate">{c.name}</span>
        </div>
      ),
    },
    {
      key: "phone",
      header: "Teléfono",
      cell: (c) =>
        c.phone ? (
          <a
            href={`tel:${c.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-sm text-foreground hover:text-[var(--ops-active)]"
          >
            <Phone className="h-3 w-3" />
            {c.phone}
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "email",
      header: "Email",
      cell: (c) =>
        c.email ? (
          <a
            href={`mailto:${c.email}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-sm text-foreground hover:text-[var(--ops-active)] truncate max-w-[180px]"
          >
            <Mail className="h-3 w-3" />
            {c.email}
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "status",
      header: "Estado",
      cell: (c) => (
        <StatusPill status={c.isActive ? "active" : "inactive"} size="sm" />
      ),
    },
    {
      key: "notes",
      header: "Notas",
      cell: (c) => (
        <span className="text-sm text-muted-foreground line-clamp-1">{c.notes ?? "—"}</span>
      ),
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
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => fillEdit(c)}>
              <SquarePen className="h-4 w-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setToDelete(c)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" /> Desactivar
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
        title="Clientes de pacas"
        description="Directorio de clientes para reservaciones y ventas. La eliminación es lógica."
        badge={`${clients.length} clientes`}
        actions={
          <Button
            variant="brand"
            onClick={() => {
              resetForm();
              setIsCreateOpen(true);
            }}
            className="hidden md:inline-flex"
          >
            <Plus className="h-4 w-4" />
            Nuevo cliente
          </Button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricTile label="Activos" value={activeCount} icon={Users} tone="success" />
        <MetricTile label="Inactivos" value={inactiveCount} icon={UserRound} tone="idle" />
        <MetricTile label="Con teléfono" value={withPhone} icon={Phone} tone="active" />
        <MetricTile label="Con email" value={withEmail} icon={Mail} tone="track" />
      </div>

      <ResponsiveListView<PacaClientItem>
        columns={columns}
        rows={filtered}
        rowKey={(c) => c.clientId}
        density="compact"
        selectedKeys={selected}
        onSelectionChange={setSelected}
        isRowSelectable={(c) => c.isActive}
        mobileCard={(c) => (
          <MobileListCard
            key={c.clientId}
            title={
              <span className="flex items-center gap-1.5">
                <UserRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {c.name}
              </span>
            }
            subtitle={
              <>
                {c.phone ?? "—"}
                {c.email && ` · ${c.email}`}
              </>
            }
            value={<StatusPill status={c.isActive ? "active" : "inactive"} size="sm" />}
            actions={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-9">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => fillEdit(c)}>
                    <SquarePen className="h-4 w-4" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setToDelete(c)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" /> Desactivar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
            meta={
              <>
                {c.phone && (
                  <a
                    href={`tel:${c.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-[11px] text-[var(--brand)] hover:underline"
                  >
                    <Phone className="h-3 w-3" />
                    Llamar
                  </a>
                )}
                {c.email && (
                  <a
                    href={`mailto:${c.email}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-[11px] text-[var(--brand)] hover:underline"
                  >
                    <Mail className="h-3 w-3" />
                    Email
                  </a>
                )}
              </>
            }
          />
        )}
        toolbar={
          <div className="flex items-center justify-between gap-2 flex-wrap w-full">
            <InputGroup className="flex-1 min-w-[180px] max-w-md">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Buscar nombre, teléfono o email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <InputGroupAddon align="inline-end">
                <Badge variant="brand">{filtered.length}</Badge>
              </InputGroupAddon>
            </InputGroup>
            {selected.size > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs text-destructive hover:text-destructive"
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Desactivar {selected.size}
              </Button>
            )}
          </div>
        }
        emptyState={
          <EmptyState
            title="Sin clientes"
            description={search ? "No hay coincidencias." : "Crea tu primer cliente para empezar."}
          />
        }
      />

      <ResponsiveFormDialog
        open={isCreateOpen || !!toEdit}
        onOpenChange={(o) => {
          if (!o) {
            setIsCreateOpen(false);
            setToEdit(null);
            resetForm();
          }
        }}
        a11yTitle={toEdit ? "Editar cliente" : "Nuevo cliente"}
        description="Información de contacto del cliente."
        desktopMaxWidth="sm:max-w-lg"
      >
        <FormDialogHeader
          icon={UserRound}
          title={toEdit ? "Editar cliente" : "Nuevo cliente"}
          description="Información de contacto del cliente."
        />
        <div className="space-y-4 mt-4">
            <FormSection icon={UserRound} title="Datos">
              <Field label="Nombre" icon={UserRound} required>
                <Input
                  placeholder="Nombre completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Teléfono" icon={Phone}>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </Field>
                <Field label="Email" icon={Mail}>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Notas" icon={FileText}>
                <Textarea
                  rows={2}
                  placeholder="Observaciones (opcional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>
            </FormSection>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsCreateOpen(false);
                setToEdit(null);
                resetForm();
              }}
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
            <AlertDialogTitle>¿Desactivar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{toDelete?.name}</strong> será marcado como inactivo. Las reservaciones y ventas
              históricas se conservarán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={submitting}
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar {selected.size} cliente(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Los clientes se marcarán como inactivos y no aparecerán en pickers ni listados activos.
              Las reservaciones y ventas históricas se conservarán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={submitting}
            >
              {submitting ? "Desactivando…" : "Desactivar todos"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Fab
        icon={Plus}
        label="Nuevo cliente"
        onClick={() => {
          resetForm();
          setIsCreateOpen(true);
        }}
      />
    </div>
  );
}
