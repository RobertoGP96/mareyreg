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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FormDialogHeader } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import {
  MoreHorizontal,
  SquarePen,
  Plus,
  Search,
  Trash2,
  Package,
  Barcode,
  ScanBarcode,
  Bookmark,
  FolderTree,
  Ruler,
  Warehouse as WarehouseIcon,
  CircleDollarSign,
  Store,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  createProduct,
  updateProduct,
  deleteProduct,
} from "../actions/product-actions";
import {
  PRODUCT_UNITS,
  UNIT_GROUPS,
  PRODUCT_CATEGORIES,
  getUnitAbbreviation,
  getUnitLabel,
} from "@/lib/constants";

interface ProductItem {
  productId: number;
  name: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  unit: string;
  minStock: number;
  maxStock: number | null;
  costPrice: number | null;
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
    } else toast.error(result.error);
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
    } else toast.error(result.error);
  };

  const getCategoryLabel = (value: string) =>
    PRODUCT_CATEGORIES.find((c) => c.value === value)?.label ?? value;

  const ProductFormFields = ({ product }: { product?: ProductItem | null }) => (
    <div className="space-y-6">
      <FormSection icon={Package} title="Información general" description="Datos básicos del producto.">
        <Field label="Nombre" icon={Package} required>
          <Input name="name" defaultValue={product?.name} required placeholder="Ej. Aceite multigrado 20W-50" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="SKU" icon={Barcode}>
            <Input name="sku" defaultValue={product?.sku ?? ""} placeholder="MAT-001" />
          </Field>
          <Field label="Código de barras" icon={ScanBarcode}>
            <Input name="barcode" defaultValue={product?.barcode ?? ""} placeholder="EAN-13" />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Categoría" icon={FolderTree}>
            <Select name="category" defaultValue={product?.category ?? undefined}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Unidad de medida" icon={Ruler} required>
            <Select name="unit" defaultValue={product?.unit ?? "unidades"}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
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
          </Field>
        </div>
      </FormSection>

      <FormSection icon={WarehouseIcon} title="Stock y costos" description="Niveles de inventario y costo unitario.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Stock mínimo" icon={WarehouseIcon}>
            <Input name="minStock" type="number" step="0.01" defaultValue={product ? String(product.minStock) : "0"} />
          </Field>
          <Field label="Stock máximo" icon={WarehouseIcon} hint="Opcional.">
            <Input name="maxStock" type="number" step="0.01" defaultValue={product?.maxStock ? String(product.maxStock) : ""} placeholder="—" />
          </Field>
          <Field label="Costo unitario" icon={CircleDollarSign}>
            <Input name="costPrice" type="number" step="0.01" defaultValue={product?.costPrice ? String(product.costPrice) : ""} placeholder="$0.00" />
          </Field>
        </div>
      </FormSection>

      <FormSection icon={Store} title="Proveedor" description="Información comercial.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Marca" icon={Bookmark}>
            <Input name="brand" defaultValue={product?.brand ?? ""} />
          </Field>
          <Field label="Proveedor" icon={Store}>
            <Input name="supplier" defaultValue={product?.supplier ?? ""} />
          </Field>
          <Field label="Ref. proveedor" icon={Barcode}>
            <Input name="supplierRef" defaultValue={product?.supplierRef ?? ""} placeholder="Código del proveedor" />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Notas" description="Información adicional (opcional).">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Descripción">
            <Textarea name="description" defaultValue={product?.description ?? ""} rows={3} />
          </Field>
          <Field label="Notas internas">
            <Textarea name="notes" defaultValue={product?.notes ?? ""} rows={3} />
          </Field>
        </div>
      </FormSection>
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Package}
        title="Productos"
        description="Catálogo de productos, componentes y materiales del inventario."
        badge={`${products.length} productos`}
        actions={
          <Button variant="brand" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Nuevo producto
          </Button>
        }
      />

      <div className="rounded-xl border border-border bg-card shadow-panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/30 px-4 py-3">
          <InputGroup className="flex-1 min-w-[240px]">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Buscar por nombre, SKU, marca, proveedor…"
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
            filtered.map((p) => (
              <div
                key={p.productId}
                className={`group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-[var(--brand)]/[0.04] ${!p.isActive ? "opacity-60" : ""}`}
              >
                <div className="flex size-11 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--brand)]/20 to-[var(--brand)]/5 ring-1 ring-inset ring-[var(--brand)]/20 shrink-0">
                  <Package className="h-5 w-5 text-[var(--brand)]" strokeWidth={2.2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground truncate">{p.name}</h3>
                    {p.sku && <Badge variant="outline">{p.sku}</Badge>}
                    {p.category && <Badge variant="info">{getCategoryLabel(p.category)}</Badge>}
                    {p.brand && <Badge variant="secondary">{p.brand}</Badge>}
                    {!p.isActive && <Badge variant="destructive">Inactivo</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-[0.82rem] text-muted-foreground">
                    <span>Unidad: <span className="font-medium text-foreground">{getUnitLabel(p.unit)} ({getUnitAbbreviation(p.unit)})</span></span>
                    <span>Min: <span className="font-medium tabular-nums text-foreground">{String(p.minStock)}</span></span>
                    {p.maxStock != null && Number(p.maxStock) > 0 && (
                      <span>Max: <span className="font-medium tabular-nums text-foreground">{String(p.maxStock)}</span></span>
                    )}
                    {p.costPrice != null && Number(p.costPrice) > 0 && (
                      <span className="text-[var(--success)]">
                        <CircleDollarSign className="h-3 w-3 inline -mt-0.5" />
                        {String(p.costPrice)}
                      </span>
                    )}
                    {p.supplier && <span>Proveedor: <span className="font-medium text-foreground">{p.supplier}</span></span>}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8 opacity-60 group-hover:opacity-100">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => setToEdit(p)}>
                      <SquarePen className="h-4 w-4" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setToDelete(p.productId)}
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
                title="No hay productos"
                description={
                  search
                    ? `No se encontraron resultados para "${search}".`
                    : "Crea el primer producto para empezar."
                }
              />
            </div>
          )}
        </div>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <FormDialogHeader
                icon={Package}
                title="Nuevo producto"
                description="Registra un nuevo producto en el catálogo."
              />
          </DialogHeader>
          <form onSubmit={(e) => handleSubmit(e)}>
            <ProductFormFields />
            <div className="flex justify-end gap-2 pt-5 border-t border-border mt-6">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="brand" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? "Creando…" : "Crear producto"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!toEdit} onOpenChange={(o) => !o && setToEdit(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <FormDialogHeader
                icon={Package}
                title="Editar producto"
                description={toEdit?.name}
              />
          </DialogHeader>
          <form onSubmit={(e) => handleSubmit(e, toEdit?.productId)}>
            <ProductFormFields product={toEdit} />
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
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
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
