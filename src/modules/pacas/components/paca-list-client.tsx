"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
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
import { MoreHorizontal, Pen, Search, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { createPaca, updatePaca, deletePaca } from "../actions/paca-actions";
import { PacaForm } from "./paca-form";
import { PACA_STATUSES } from "@/lib/constants";

interface PacaItem {
  pacaId: number;
  code: string;
  weightKg: string | number | { toString(): string };
  status: string;
  origin: string | null;
  supplier: string | null;
  purchasePrice: string | number | null;
  salePrice: string | number | null;
  arrivalDate: string | null;
  notes: string | null;
  categoryId: number;
  warehouseId: number | null;
  category: { categoryId: number; name: string };
  warehouse: { warehouseId: number; name: string } | null;
}

interface CategoryItem {
  categoryId: number;
  name: string;
}

interface WarehouseItem {
  warehouseId: number;
  name: string;
}

interface Props {
  initialPacas: PacaItem[];
  categories: CategoryItem[];
  warehouses: WarehouseItem[];
}

const STATUS_COLORS: Record<string, string> = {
  available: "bg-green-100 text-green-800",
  sold: "bg-red-100 text-red-800",
  in_transit: "bg-yellow-100 text-yellow-800",
  reserved: "bg-blue-100 text-blue-800",
};

export function PacaListClient({ initialPacas, categories, warehouses }: Props) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [pacaToDelete, setPacaToDelete] = useState<number | null>(null);
  const [pacaToEdit, setPacaToEdit] = useState<PacaItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filtered = initialPacas.filter(
    (p) =>
      p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.supplier?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.origin?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = async (data: Record<string, unknown>) => {
    setIsSubmitting(true);
    const result = await createPaca(data as Parameters<typeof createPaca>[0]);
    setIsSubmitting(false);
    if (result.success) {
      setIsCreateOpen(false);
      toast.success("Paca creada exitosamente");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const handleUpdate = async (data: Record<string, unknown>) => {
    if (!pacaToEdit) return;
    setIsSubmitting(true);
    const result = await updatePaca(pacaToEdit.pacaId, data as Parameters<typeof updatePaca>[1]);
    setIsSubmitting(false);
    if (result.success) {
      setPacaToEdit(null);
      toast.success("Paca actualizada");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const handleDelete = async () => {
    if (!pacaToDelete) return;
    setIsSubmitting(true);
    const result = await deletePaca(pacaToDelete);
    setIsSubmitting(false);
    if (result.success) {
      setPacaToDelete(null);
      toast.success("Paca eliminada");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const getStatusLabel = (status: string) =>
    PACA_STATUSES.find((s) => s.value === status)?.label ?? status;

  return (
    <>
      <div className="bg-card shadow-sm rounded-lg border">
        <div className="px-6 py-4 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium">Lista de Pacas</h2>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Agregar
            </Button>
          </div>
          <div className="mt-4">
            <InputGroup>
              <InputGroupInput
                placeholder="Buscar por codigo, categoria, proveedor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupAddon align="inline-end">
                <Badge>{filtered.length}</Badge>
              </InputGroupAddon>
            </InputGroup>
          </div>
        </div>
        <div className="grid gap-4 p-6">
          {filtered.length > 0 ? (
            filtered.map((paca) => (
              <div
                key={paca.pacaId}
                className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{paca.code}</h3>
                      <Badge className={STATUS_COLORS[paca.status]}>
                        {getStatusLabel(paca.status)}
                      </Badge>
                      <Badge variant="outline">{paca.category.name}</Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm text-muted-foreground">
                      <span>Peso: {String(paca.weightKg)} kg</span>
                      {paca.supplier && <span>Proveedor: {paca.supplier}</span>}
                      {paca.origin && <span>Origen: {paca.origin}</span>}
                      {paca.purchasePrice && <span>Compra: ${String(paca.purchasePrice)}</span>}
                      {paca.salePrice && <span>Venta: ${String(paca.salePrice)}</span>}
                      {paca.warehouse && <span>Almacen: {paca.warehouse.name}</span>}
                      {paca.arrivalDate && <span>Llegada: {paca.arrivalDate}</span>}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setPacaToEdit(paca)}>
                        <Pen className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setPacaToDelete(paca.pacaId)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          ) : (
            <EmptyState title="No hay pacas" description="No se encontraron pacas registradas." />
          )}
        </div>
      </div>

      <PacaForm
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSubmit={handleCreate}
        isLoading={isSubmitting}
        categories={categories}
        warehouses={warehouses}
      />

      <PacaForm
        open={!!pacaToEdit}
        onOpenChange={(open) => !open && setPacaToEdit(null)}
        onSubmit={handleUpdate}
        isLoading={isSubmitting}
        categories={categories}
        warehouses={warehouses}
        paca={pacaToEdit}
      />

      <AlertDialog open={!!pacaToDelete} onOpenChange={() => setPacaToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar paca?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
