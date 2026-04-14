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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoreHorizontal, Pen, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createProduct, updateProduct, deleteProduct } from "../actions/product-actions";
import { PRODUCT_UNITS, UNIT_GROUPS, PRODUCT_CATEGORIES, getUnitAbbreviation, getUnitLabel } from "@/lib/constants";

interface ProductItem {
  productId: number;
  name: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  unit: string;
  minStock: unknown;
  maxStock: unknown;
  costPrice: unknown;
  brand: string | null;
  supplier: string | null;
  supplierRef: string | null;
  isActive: boolean;
  description: string | null;
  notes: string | null;
}

export function ProductListClient({ products }: { products: ProductItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toEdit, setToEdit] = useState<ProductItem | null>(null);
  const [toDelete, setToDelete] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode?.toLowerCase().includes(search.toLowerCase()) ||
      p.category?.toLowerCase().includes(search.toLowerCase()) ||
      p.brand?.toLowerCase().includes(search.toLowerCase()) ||
      p.supplier?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>, editId?: number) => {
    e.preventDefault();
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const data = {
      name: fd.get("name") as string,
      sku: (fd.get("sku") as string) || undefined,
      barcode: (fd.get("barcode") as string) || undefined,
      category: (fd.get("category") as string) || undefined,
      unit: fd.get("unit") as string,
      minStock: fd.get("minStock") ? Number(fd.get("minStock")) : 0,
      maxStock: fd.get("maxStock") ? Number(fd.get("maxStock")) : undefined,
      costPrice: fd.get("costPrice") ? Number(fd.get("costPrice")) : undefined,
      brand: (fd.get("brand") as string) || undefined,
      supplier: (fd.get("supplier") as string) || undefined,
      supplierRef: (fd.get("supplierRef") as string) || undefined,
      description: (fd.get("description") as string) || undefined,
      notes: (fd.get("notes") as string) || undefined,
    };

    const result = editId
      ? await updateProduct(editId, data)
      : await createProduct(data);

    setIsSubmitting(false);
    if (result.success) {
      setIsCreateOpen(false);
      setToEdit(null);
      toast.success(editId ? "Producto actualizado" : "Producto creado");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setIsSubmitting(true);
    const result = await deleteProduct(toDelete);
    setIsSubmitting(false);
    if (result.success) {
      setToDelete(null);
      toast.success("Producto eliminado");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const getCategoryLabel = (value: string) =>
    PRODUCT_CATEGORIES.find((c) => c.value === value)?.label ?? value;

  const ProductFormFields = ({ product }: { product?: ProductItem | null }) => (
    <div className="space-y-4">
      {/* Nombre */}
      <div className="space-y-2">
        <Label>Nombre *</Label>
        <Input name="name" defaultValue={product?.name} required />
      </div>

      {/* SKU y Codigo de barras */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>SKU</Label>
          <Input name="sku" defaultValue={product?.sku ?? ""} placeholder="Ej: MAT-001" />
        </div>
        <div className="space-y-2">
          <Label>Codigo de barras</Label>
          <Input name="barcode" defaultValue={product?.barcode ?? ""} placeholder="EAN-13" />
        </div>
      </div>

      {/* Categoria y Unidad */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Categoria</Label>
          <Select name="category" defaultValue={product?.category ?? undefined}>
            <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
            <SelectContent>
              {PRODUCT_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Unidad de medida *</Label>
          <Select name="unit" defaultValue={product?.unit ?? "unidades"}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {UNIT_GROUPS.map((group) => (
                <SelectGroup key={group}>
                  <SelectLabel>{group}</SelectLabel>
                  {PRODUCT_UNITS.filter((u) => u.group === group).map((u) => (
                    <SelectItem key={u.value} value={u.value}>
                      {u.label} ({u.abbreviation})
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stock min, max, costo */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Stock minimo</Label>
          <Input name="minStock" type="number" step="0.01" defaultValue={product ? String(product.minStock) : "0"} />
        </div>
        <div className="space-y-2">
          <Label>Stock maximo</Label>
          <Input name="maxStock" type="number" step="0.01" defaultValue={product?.maxStock ? String(product.maxStock) : ""} placeholder="Opcional" />
        </div>
        <div className="space-y-2">
          <Label>Costo unitario</Label>
          <Input name="costPrice" type="number" step="0.01" defaultValue={product?.costPrice ? String(product.costPrice) : ""} placeholder="$0.00" />
        </div>
      </div>

      {/* Marca, Proveedor, Ref */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Marca</Label>
          <Input name="brand" defaultValue={product?.brand ?? ""} />
        </div>
        <div className="space-y-2">
          <Label>Proveedor</Label>
          <Input name="supplier" defaultValue={product?.supplier ?? ""} />
        </div>
        <div className="space-y-2">
          <Label>Ref. proveedor</Label>
          <Input name="supplierRef" defaultValue={product?.supplierRef ?? ""} placeholder="Codigo del proveedor" />
        </div>
      </div>

      {/* Descripcion y Notas */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Descripcion</Label>
          <Textarea name="description" defaultValue={product?.description ?? ""} rows={2} />
        </div>
        <div className="space-y-2">
          <Label>Notas internas</Label>
          <Textarea name="notes" defaultValue={product?.notes ?? ""} rows={2} />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="bg-card rounded-lg border">
        <div className="px-4 py-3 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-medium">Productos</h2>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />Agregar
            </Button>
          </div>
          <div className="mt-4">
            <InputGroup>
              <InputGroupInput placeholder="Buscar por nombre, SKU, marca, proveedor..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <InputGroupAddon><Search /></InputGroupAddon>
              <InputGroupAddon align="inline-end"><Badge>{filtered.length}</Badge></InputGroupAddon>
            </InputGroup>
          </div>
        </div>
        <div className="grid gap-4 p-4">
          {filtered.length > 0 ? filtered.map((p) => (
            <div key={p.productId} className={`bg-card border rounded-lg p-4 flex items-center justify-between ${!p.isActive ? "opacity-50" : ""}`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{p.name}</p>
                  {p.sku && <Badge variant="outline">{p.sku}</Badge>}
                  {p.category && <Badge variant="secondary">{getCategoryLabel(p.category)}</Badge>}
                  {p.brand && <Badge variant="secondary" className="bg-blue-50 text-blue-700">{p.brand}</Badge>}
                  {!p.isActive && <Badge variant="destructive">Inactivo</Badge>}
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
                  <span>Unidad: {getUnitLabel(p.unit)} ({getUnitAbbreviation(p.unit)})</span>
                  <span>Stock min: {String(p.minStock)}</span>
                  {p.maxStock != null && Number(p.maxStock) > 0 && <span>Stock max: {String(p.maxStock)}</span>}
                  {p.costPrice != null && Number(p.costPrice) > 0 && <span>Costo: ${String(p.costPrice)}</span>}
                  {p.supplier && <span>Proveedor: {p.supplier}</span>}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setToEdit(p)}><Pen className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setToDelete(p.productId)} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )) : <EmptyState title="No hay productos" description="No se encontraron productos." />}
        </div>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nuevo Producto</DialogTitle></DialogHeader>
          <form onSubmit={(e) => handleSubmit(e)}>
            <ProductFormFields />
            <Button type="submit" className="w-full mt-4" disabled={isSubmitting}>
              {isSubmitting ? "Creando..." : "Crear Producto"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!toEdit} onOpenChange={(o) => !o && setToEdit(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Producto</DialogTitle></DialogHeader>
          <form onSubmit={(e) => handleSubmit(e, toEdit?.productId)}>
            <ProductFormFields product={toEdit} />
            <Button type="submit" className="w-full mt-4" disabled={isSubmitting}>
              {isSubmitting ? "Actualizando..." : "Actualizar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={() => setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Eliminar producto?</AlertDialogTitle>
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
