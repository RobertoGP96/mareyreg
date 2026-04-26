"use client";

import { useState } from "react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FormDialogHeader } from "@/components/ui/field";
import {
  MoreHorizontal,
  SquarePen,
  Plus,
  Search,
  Trash2,
  Warehouse as WarehouseIcon,
  MapPin,
  Phone,
  PackageCheck,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
} from "../actions/warehouse-actions";
import { CUBAN_PROVINCES, WAREHOUSE_TYPES } from "@/lib/constants";

interface WarehouseItem {
  warehouseId: number;
  name: string;
  location: string | null;
  province: string | null;
  capacity: number | null;
  warehouseType: string | null;
  contactPhone: string | null;
  isActive: boolean;
}

export function WarehouseListClient({ warehouses }: { warehouses: WarehouseItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toEdit, setToEdit] = useState<WarehouseItem | null>(null);
  const [toDelete, setToDelete] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filtered = warehouses.filter(
    (w) =>
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.location?.toLowerCase().includes(search.toLowerCase()) ||
      w.province?.toLowerCase().includes(search.toLowerCase())
  );

  const getWarehouseTypeLabel = (value: string) =>
    WAREHOUSE_TYPES.find((t) => t.value === value)?.label ?? value;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>, editId?: number) => {
    e.preventDefault();
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const data = {
      name: fd.get("name") as string,
      location: (fd.get("location") as string) || undefined,
      province: (fd.get("province") as string) || undefined,
      capacity: fd.get("capacity") ? Number(fd.get("capacity")) : undefined,
      warehouseType: (fd.get("warehouseType") as string) || undefined,
      contactPhone: (fd.get("contactPhone") as string) || undefined,
    };

    const result = editId
      ? await updateWarehouse(editId, data)
      : await createWarehouse(data);

    setIsSubmitting(false);
    if (result.success) {
      setIsCreateOpen(false);
      setToEdit(null);
      toast.success(editId ? "Almacén actualizado" : "Almacén creado");
      router.refresh();
    } else toast.error(result.error);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setIsSubmitting(true);
    const result = await deleteWarehouse(toDelete);
    setIsSubmitting(false);
    if (result.success) {
      setToDelete(null);
      toast.success("Almacén eliminado");
      router.refresh();
    } else toast.error(result.error);
  };

  const FormFields = ({ warehouse }: { warehouse?: WarehouseItem | null }) => (
    <div className="space-y-5">
      <Field label="Nombre" icon={WarehouseIcon} required>
        <Input name="name" defaultValue={warehouse?.name} required placeholder="Ej. Almacén central" />
      </Field>
      <Field label="Ubicación" icon={MapPin}>
        <Input name="location" defaultValue={warehouse?.location ?? ""} placeholder="Dirección o referencia" />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Provincia" icon={MapPin}>
          <Select name="province" defaultValue={warehouse?.province ?? undefined}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
            <SelectContent>
              {CUBAN_PROVINCES.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Tipo de almacén" icon={PackageCheck}>
          <Select name="warehouseType" defaultValue={warehouse?.warehouseType ?? undefined}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
            <SelectContent>
              {WAREHOUSE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Capacidad" icon={PackageCheck}>
          <Input name="capacity" type="number" defaultValue={warehouse?.capacity ? String(warehouse.capacity) : ""} />
        </Field>
        <Field label="Teléfono de contacto" icon={Phone}>
          <Input name="contactPhone" defaultValue={warehouse?.contactPhone ?? ""} placeholder="+53 …" />
        </Field>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        icon={WarehouseIcon}
        title="Almacenes"
        description="Puntos de almacenamiento y distribución con ubicación y capacidad."
        badge={`${warehouses.length} almacenes`}
      >
        <Button variant="brand" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Nuevo almacén
        </Button>
      </PageHeader>

      <div className="rounded-xl border border-border bg-card shadow-panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/30 px-4 py-3">
          <InputGroup className="flex-1 min-w-[240px]">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Buscar por nombre, ubicación o provincia…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <InputGroupAddon align="inline-end">
              <Badge variant="brand">{filtered.length}</Badge>
            </InputGroupAddon>
          </InputGroup>
        </div>

        <div className="divide-y divide-border/60">
          {filtered.length > 0 ? (
            filtered.map((w) => (
              <div
                key={w.warehouseId}
                className={`group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-[var(--brand)]/[0.04] ${!w.isActive ? "opacity-60" : ""}`}
              >
                <div className="flex size-11 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--brand)]/20 to-[var(--brand)]/5 ring-1 ring-inset ring-[var(--brand)]/20 shrink-0">
                  <WarehouseIcon className="h-5 w-5 text-[var(--brand)]" strokeWidth={2.2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground truncate">{w.name}</h3>
                    {w.warehouseType && (
                      <Badge variant="info">{getWarehouseTypeLabel(w.warehouseType)}</Badge>
                    )}
                    {!w.isActive && <Badge variant="destructive">Inactivo</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-[0.82rem] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {[w.location, w.province].filter(Boolean).join(", ") || "Sin ubicación"}
                    </span>
                    {w.capacity != null && Number(w.capacity) > 0 && (
                      <span className="inline-flex items-center gap-1.5">
                        <PackageCheck className="h-3.5 w-3.5" />
                        Cap.: <span className="tabular-nums font-medium text-foreground">{String(w.capacity)}</span>
                      </span>
                    )}
                    {w.contactPhone && (
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" />
                        {w.contactPhone}
                      </span>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8 opacity-60 group-hover:opacity-100">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => setToEdit(w)}>
                      <SquarePen className="h-4 w-4" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setToDelete(w.warehouseId)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" /> Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          ) : (
            <div className="p-8">
              <EmptyState
                title="No hay almacenes"
                description={
                  search
                    ? `No se encontraron resultados para "${search}".`
                    : "Registra el primer almacén para empezar."
                }
              />
            </div>
          )}
        </div>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <FormDialogHeader
                icon={WarehouseIcon}
                title="Nuevo almacén"
                description="Registra un nuevo punto de almacenamiento."
              />
          </DialogHeader>
          <form onSubmit={(e) => handleSubmit(e)}>
            <FormFields />
            <div className="flex justify-end gap-2 pt-5 border-t border-border mt-6">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="brand" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? "Creando…" : "Crear almacén"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!toEdit} onOpenChange={(o) => !o && setToEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <FormDialogHeader
                icon={WarehouseIcon}
                title="Editar almacén"
                description={toEdit?.name}
              />
          </DialogHeader>
          <form onSubmit={(e) => handleSubmit(e, toEdit?.warehouseId)}>
            <FormFields warehouse={toEdit} />
            <div className="flex justify-end gap-2 pt-5 border-t border-border mt-6">
              <Button type="button" variant="outline" onClick={() => setToEdit(null)}>
                Cancelar
              </Button>
              <Button type="submit" variant="brand" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? "Actualizando…" : "Actualizar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={() => setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar almacén?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
