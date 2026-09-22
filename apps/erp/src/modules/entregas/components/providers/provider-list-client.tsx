"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { MobileListCard } from "@/components/ui/mobile-list-card";
import { ResponsiveListView } from "@/components/ui/responsive-list-view";
import { Fab } from "@/components/ui/fab";
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
  Building2, Plus, Search, MoreHorizontal, SquarePen, Trash2, Loader2, ToggleLeft,
} from "lucide-react";
import { toast } from "@/lib/toast";
import {
  createDeliveryProvider,
  updateDeliveryProvider,
  toggleDeliveryProviderActive,
  deleteDeliveryProvider,
} from "../../actions/provider-actions";
import type { ProviderRow } from "../../queries/provider-queries";

interface Props {
  initialProviders: ProviderRow[];
}

export function ProviderListClient({ initialProviders }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toEdit, setToEdit] = useState<ProviderRow | null>(null);
  const [toDelete, setToDelete] = useState<ProviderRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [active, setActive] = useState(true);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return initialProviders;
    return initialProviders.filter((p) => p.name.toLowerCase().includes(q));
  }, [initialProviders, search]);

  const resetForm = () => {
    setName("");
    setActive(true);
  };
  const fillEdit = (p: ProviderRow) => {
    setName(p.name);
    setActive(p.active);
    setToEdit(p);
  };
  const closeForm = () => {
    setIsCreateOpen(false);
    setToEdit(null);
    resetForm();
  };

  const validate = () =>
    name.trim().length < 2 ? "El nombre es requerido (mínimo 2 caracteres)" : null;

  const handleSave = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSubmitting(true);
    try {
      const input = { name: name.trim(), active };
      const r = toEdit
        ? await updateDeliveryProvider(toEdit.providerId, input)
        : await createDeliveryProvider(input);
      if (r.success) {
        toast.success(toEdit ? "Proveedor actualizado" : "Proveedor creado");
        closeForm();
        router.refresh();
      } else {
        toast.error(r.error);
      }
    } catch (error) {
      console.error("saveDeliveryProvider:", error);
      toast.error("No se pudo guardar el proveedor");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (p: ProviderRow) => {
    try {
      const res = await toggleDeliveryProviderActive(p.providerId);
      if (res.success) {
        toast.success(res.data.active ? "Proveedor activado" : "Proveedor desactivado");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch (error) {
      console.error("toggleDeliveryProviderActive:", error);
      toast.error("No se pudo cambiar el estado");
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setSubmitting(true);
    try {
      const res = await deleteDeliveryProvider(toDelete.providerId);
      if (res.success) {
        toast.success("Proveedor eliminado");
        setToDelete(null);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch (error) {
      console.error("deleteDeliveryProvider:", error);
      toast.error("No se pudo eliminar el proveedor");
    } finally {
      setSubmitting(false);
    }
  };

  const rowActions = (p: ProviderRow, size: "size-8" | "size-9") => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={size}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => fillEdit(p)}>
          <SquarePen className="h-4 w-4" /> Editar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleToggle(p)}>
          <ToggleLeft className="h-4 w-4" /> {p.active ? "Desactivar" : "Activar"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setToDelete(p)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4" /> Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const columns: DataTableColumn<ProviderRow>[] = [
    {
      key: "name",
      header: "Nombre",
      cell: (p) => <span className="font-medium text-foreground truncate">{p.name}</span>,
    },
    {
      key: "deliveries",
      header: "Entregas",
      align: "right",
      cell: (p) =>
        p.deliveriesCount > 0 ? (
          <Badge variant="brand">{p.deliveriesCount}</Badge>
        ) : (
          <Badge variant="outline">0</Badge>
        ),
    },
    {
      key: "status",
      header: "Estado",
      align: "right",
      cell: (p) => <StatusPill status={p.active ? "active" : "inactive"} size="sm" />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "w-12",
      cell: (p) => rowActions(p, "size-8"),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Proveedores"
        description="Catálogo de quienes envían el efectivo de las entregas. Reusa estos nombres en cada entrega."
        badge={`${initialProviders.length} proveedores`}
        actions={
          <Button
            variant="brand"
            onClick={() => {
              resetForm();
              setIsCreateOpen(true);
            }}
            className="hidden md:inline-flex"
          >
            <Plus className="h-4 w-4" /> Nuevo proveedor
          </Button>
        }
      />

      <ResponsiveListView<ProviderRow>
        columns={columns}
        rows={filtered}
        rowKey={(p) => p.providerId}
        mobileCard={(p) => (
          <MobileListCard
            key={p.providerId}
            title={
              <span className="flex items-center gap-2 min-w-0">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium truncate">{p.name}</span>
              </span>
            }
            subtitle={
              <span className="text-[11px] text-muted-foreground">
                {p.deliveriesCount} entrega{p.deliveriesCount === 1 ? "" : "s"}
              </span>
            }
            value={<StatusPill status={p.active ? "active" : "inactive"} size="sm" />}
            actions={rowActions(p, "size-9")}
          />
        )}
        toolbar={
          <InputGroup className="flex-1 min-w-[180px] max-w-md">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Buscar por nombre…"
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
            title="Sin proveedores"
            description={
              search
                ? "No hay coincidencias."
                : "Agrega proveedores para indicar de quién proviene el efectivo de cada entrega."
            }
          />
        }
      />

      <ResponsiveFormDialog
        open={isCreateOpen || !!toEdit}
        onOpenChange={(o) => {
          if (!o) closeForm();
        }}
        a11yTitle={toEdit ? "Editar proveedor" : "Nuevo proveedor"}
        description="Solo necesitas el nombre."
        desktopMaxWidth="sm:max-w-md"
      >
        <FormDialogHeader
          icon={Building2}
          title={toEdit ? "Editar proveedor" : "Nuevo proveedor"}
          description="Solo necesitas el nombre."
        />
        <div className="space-y-4 mt-4">
          <FormSection icon={Building2} title="Identificación">
            <Field label="Nombre" icon={Building2} required>
              <Input
                placeholder="Remesas del Norte"
                value={name}
                maxLength={120}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSave();
                }}
              />
            </Field>
          </FormSection>

          <FormSection icon={ToggleLeft} title="Estado">
            <Field label="Activo" icon={ToggleLeft} hint="Solo los activos aparecen al registrar entregas.">
              <div className="flex items-center gap-3">
                <Switch checked={active} onCheckedChange={setActive} />
                <span className="text-sm text-muted-foreground">{active ? "Sí" : "No"}</span>
              </div>
            </Field>
          </FormSection>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button type="button" variant="outline" onClick={closeForm}>
            Cancelar
          </Button>
          <Button type="button" variant="brand" onClick={handleSave} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Guardando…" : toEdit ? "Actualizar" : "Crear"}
          </Button>
        </div>
      </ResponsiveFormDialog>

      <AlertDialog open={!!toDelete} onOpenChange={() => setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar proveedor?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.deliveriesCount
                ? `${toDelete.deliveriesCount} entrega(s) asocian a "${toDelete.name}" y bloquean la eliminación. Desactívalo en su lugar.`
                : `Se eliminará al proveedor "${toDelete?.name}".`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={submitting || (toDelete?.deliveriesCount ?? 0) > 0}
            >
              {submitting ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Fab
        icon={Plus}
        label="Nuevo proveedor"
        onClick={() => {
          resetForm();
          setIsCreateOpen(true);
        }}
      />
    </div>
  );
}
