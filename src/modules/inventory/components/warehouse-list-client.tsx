"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoreHorizontal, Pen, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createWarehouse, updateWarehouse, deleteWarehouse } from "../actions/warehouse-actions";
import { CUBAN_PROVINCES, WAREHOUSE_TYPES } from "@/lib/constants";

interface WarehouseItem {
  warehouseId: number;
  name: string;
  location: string | null;
  province: string | null;
  capacity: unknown;
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
      toast.success(editId ? "Almacen actualizado" : "Almacen creado");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setIsSubmitting(true);
    const result = await deleteWarehouse(toDelete);
    setIsSubmitting(false);
    if (result.success) {
      setToDelete(null);
      toast.success("Almacen eliminado");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const FormFields = ({ warehouse }: { warehouse?: WarehouseItem | null }) => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Nombre *</Label>
        <Input name="name" defaultValue={warehouse?.name} required />
      </div>
      <div className="space-y-2">
        <Label>Ubicacion</Label>
        <Input name="location" defaultValue={warehouse?.location ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Provincia</Label>
          <Select name="province" defaultValue={warehouse?.province ?? undefined}>
            <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
            <SelectContent>
              {CUBAN_PROVINCES.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Tipo de almacen</Label>
          <Select name="warehouseType" defaultValue={warehouse?.warehouseType ?? undefined}>
            <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
            <SelectContent>
              {WAREHOUSE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Capacidad</Label>
          <Input name="capacity" type="number" defaultValue={warehouse?.capacity ? String(warehouse.capacity) : ""} />
        </div>
        <div className="space-y-2">
          <Label>Telefono de contacto</Label>
          <Input name="contactPhone" defaultValue={warehouse?.contactPhone ?? ""} placeholder="+53 ..." />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="bg-card rounded-lg border">
        <div className="px-4 py-3 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-medium">Almacenes</h2>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />Agregar
            </Button>
          </div>
          <div className="mt-4">
            <InputGroup>
              <InputGroupInput placeholder="Buscar almacenes..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <InputGroupAddon><Search /></InputGroupAddon>
              <InputGroupAddon align="inline-end"><Badge>{filtered.length}</Badge></InputGroupAddon>
            </InputGroup>
          </div>
        </div>
        <div className="grid gap-4 p-4">
          {filtered.length > 0 ? filtered.map((w) => (
            <div key={w.warehouseId} className={`bg-card border rounded-lg p-4 flex items-center justify-between ${!w.isActive ? "opacity-50" : ""}`}>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{w.name}</p>
                  {w.warehouseType && <Badge variant="secondary">{getWarehouseTypeLabel(w.warehouseType)}</Badge>}
                  {!w.isActive && <Badge variant="destructive">Inactivo</Badge>}
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                  <span>{[w.location, w.province].filter(Boolean).join(", ") || "Sin ubicacion"}</span>
                  {w.capacity != null && Number(w.capacity) > 0 && <span>Capacidad: {String(w.capacity)}</span>}
                  {w.contactPhone && <span>Tel: {w.contactPhone}</span>}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setToEdit(w)}><Pen className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setToDelete(w.warehouseId)} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )) : <EmptyState title="No hay almacenes" description="No se encontraron almacenes." />}
        </div>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent><DialogHeader><DialogTitle>Nuevo Almacen</DialogTitle></DialogHeader>
          <form onSubmit={(e) => handleSubmit(e)}>
            <FormFields />
            <Button type="submit" className="w-full mt-4" disabled={isSubmitting}>
              {isSubmitting ? "Creando..." : "Crear Almacen"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!toEdit} onOpenChange={(o) => !o && setToEdit(null)}>
        <DialogContent><DialogHeader><DialogTitle>Editar Almacen</DialogTitle></DialogHeader>
          <form onSubmit={(e) => handleSubmit(e, toEdit?.warehouseId)}>
            <FormFields warehouse={toEdit} />
            <Button type="submit" className="w-full mt-4" disabled={isSubmitting}>
              {isSubmitting ? "Actualizando..." : "Actualizar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={() => setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Eliminar almacen?</AlertDialogTitle>
            <AlertDialogDescription>Esta accion no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isSubmitting}>
              {isSubmitting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
