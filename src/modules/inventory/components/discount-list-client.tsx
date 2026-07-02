"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
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
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FormDialogHeader } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import {
  MoreHorizontal,
  SquarePen,
  Plus,
  Trash2,
  Tag,
  Percent,
  CalendarRange,
  Layers,
  Loader2,
} from "lucide-react";
import { toast } from "@/lib/toast";
import {
  createDiscount,
  updateDiscount,
  toggleDiscount,
  deleteDiscount,
  type DiscountInput,
} from "../actions/discount-actions";

interface DiscountItem {
  discountId: number;
  name: string;
  type: string;
  value: number;
  minQty: number | null;
  startsAt: string | null;
  endsAt: string | null;
  productId: number | null;
  productName: string | null;
  category: string | null;
  customerId: number | null;
  customerName: string | null;
  isActive: boolean;
  version: number;
}

interface ProductOption {
  productId: number;
  name: string;
  category: string | null;
}

interface CustomerOption {
  customerId: number;
  name: string;
}

const TYPE_LABELS: Record<string, string> = {
  percent: "Porcentaje",
  fixed: "Monto fijo",
  volume: "Por volumen",
};

function scopeLabel(d: DiscountItem): string {
  if (d.productId) return d.productName ?? `Producto #${d.productId}`;
  if (d.category) return `Categoría: ${d.category}`;
  return "Todos los productos";
}

export function DiscountListClient({
  discounts,
  products,
  customers,
}: {
  discounts: DiscountItem[];
  products: ProductOption[];
  customers: CustomerOption[];
}) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toEdit, setToEdit] = useState<DiscountItem | null>(null);
  const [toDelete, setToDelete] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scope, setScope] = useState<"all" | "product" | "category">("all");

  const categories = Array.from(
    new Set(products.map((p) => p.category).filter((c): c is string => !!c))
  );

  const openCreate = () => {
    setScope("all");
    setIsCreateOpen(true);
  };

  const openEdit = (d: DiscountItem) => {
    setToEdit(d);
    setScope(d.productId ? "product" : d.category ? "category" : "all");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>, editId?: number) => {
    e.preventDefault();
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const data: DiscountInput = {
      name: fd.get("name") as string,
      type: fd.get("type") as DiscountInput["type"],
      value: Number(fd.get("value")),
      minQty: fd.get("minQty") ? Number(fd.get("minQty")) : undefined,
      startsAt: (fd.get("startsAt") as string) || undefined,
      endsAt: (fd.get("endsAt") as string) || undefined,
      productId: scope === "product" && fd.get("productId") ? Number(fd.get("productId")) : undefined,
      category: scope === "category" ? (fd.get("category") as string) || undefined : undefined,
      customerId: fd.get("customerId") ? Number(fd.get("customerId")) : undefined,
      ...(editId != null && toEdit != null ? { version: toEdit.version } : {}),
    };

    const result = editId ? await updateDiscount(editId, data) : await createDiscount(data);

    setIsSubmitting(false);
    if (result.success) {
      setIsCreateOpen(false);
      setToEdit(null);
      toast.success(editId ? "Descuento actualizado" : "Descuento creado");
      router.refresh();
    } else toast.error(result.error);
  };

  const handleToggle = async (d: DiscountItem) => {
    const result = await toggleDiscount(d.discountId, !d.isActive);
    if (result.success) {
      toast.success(d.isActive ? "Descuento desactivado" : "Descuento activado");
      router.refresh();
    } else toast.error(result.error);
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setIsSubmitting(true);
    const result = await deleteDiscount(toDelete);
    setIsSubmitting(false);
    if (result.success) {
      setToDelete(null);
      toast.success("Descuento eliminado");
      router.refresh();
    } else toast.error(result.error);
  };

  const DiscountFormFields = ({ discount }: { discount?: DiscountItem | null }) => (
    <div className="space-y-6">
      <FormSection icon={Tag} title="Datos del descuento" description="Nombre y tipo de rebaja.">
        <Field label="Nombre" icon={Tag} required>
          <Input name="name" defaultValue={discount?.name} required placeholder="Ej. Liquidación de temporada" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Tipo" icon={Percent} required>
            <Select name="type" defaultValue={discount?.type ?? "percent"}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Valor" icon={Percent} hint="Porcentaje (0-100) o monto fijo según el tipo." required>
            <Input name="value" type="number" step="0.01" defaultValue={discount?.value ?? ""} required />
          </Field>
        </div>
        <Field label="Cantidad mínima" icon={Layers} hint="Opcional. Requerido para descuentos por volumen.">
          <Input name="minQty" type="number" step="1" defaultValue={discount?.minQty ?? ""} placeholder="—" />
        </Field>
      </FormSection>

      <FormSection icon={CalendarRange} title="Vigencia" description="Opcional: rango de fechas en que aplica.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Desde">
            <Input name="startsAt" type="date" defaultValue={discount?.startsAt?.slice(0, 10) ?? ""} />
          </Field>
          <Field label="Hasta">
            <Input name="endsAt" type="date" defaultValue={discount?.endsAt?.slice(0, 10) ?? ""} />
          </Field>
        </div>
      </FormSection>

      <FormSection icon={Layers} title="Alcance" description="A qué productos aplica.">
        <Field label="Alcance">
          <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los productos</SelectItem>
              <SelectItem value="category">Una categoría</SelectItem>
              <SelectItem value="product">Un producto específico</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {scope === "product" && (
          <Field label="Producto" required>
            <Select name="productId" defaultValue={discount?.productId ? String(discount.productId) : undefined}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {products.map((p) => (
                  <SelectItem key={p.productId} value={String(p.productId)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        {scope === "category" && (
          <Field label="Categoría" required>
            <Select name="category" defaultValue={discount?.category ?? undefined}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <Field label="Cliente" hint="Opcional. Restringe el descuento a un solo cliente.">
          <Select name="customerId" defaultValue={discount?.customerId ? String(discount.customerId) : undefined}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Todos los clientes" /></SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {customers.map((c) => (
                <SelectItem key={c.customerId} value={String(c.customerId)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FormSection>
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Tag}
        title="Descuentos"
        description="Reglas de rebaja aplicables en todos los canales de venta (POS, B2B y tienda en línea)."
        badge={`${discounts.length} descuentos`}
        actions={
          <Button variant="brand" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nuevo descuento
          </Button>
        }
      />

      <div className="rounded-xl border border-border bg-card shadow-panel overflow-hidden">
        <div className="divide-y divide-border/60">
          {discounts.length > 0 ? (
            discounts.map((d) => (
              <div
                key={d.discountId}
                className={`group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-[var(--brand)]/[0.04] ${!d.isActive ? "opacity-60" : ""}`}
              >
                <div className="flex size-11 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--brand)]/20 to-[var(--brand)]/5 ring-1 ring-inset ring-[var(--brand)]/20 shrink-0">
                  <Tag className="h-5 w-5 text-[var(--brand)]" strokeWidth={2.2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground truncate">{d.name}</h3>
                    <Badge variant="outline">{TYPE_LABELS[d.type] ?? d.type}</Badge>
                    <Badge variant="info">
                      {d.type === "fixed" ? `$${d.value}` : `${d.value}%`}
                    </Badge>
                    {!d.isActive && <Badge variant="destructive">Inactivo</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-[0.82rem] text-muted-foreground">
                    <span>{scopeLabel(d)}</span>
                    {d.customerName && <span>Cliente: <span className="font-medium text-foreground">{d.customerName}</span></span>}
                    {d.minQty != null && <span>Cant. mín: {d.minQty}</span>}
                    {(d.startsAt || d.endsAt) && (
                      <span>
                        Vigencia: {d.startsAt ? new Date(d.startsAt).toLocaleDateString("es-MX") : "—"} a{" "}
                        {d.endsAt ? new Date(d.endsAt).toLocaleDateString("es-MX") : "—"}
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
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => openEdit(d)}>
                      <SquarePen className="h-4 w-4" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggle(d)}>
                      {d.isActive ? "Desactivar" : "Activar"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setToDelete(d.discountId)}
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
                title="No hay descuentos"
                description="Crea el primer descuento o promoción para aplicar en las ventas."
              />
            </div>
          )}
        </div>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <FormDialogHeader icon={Tag} title="Nuevo descuento" description="Define una regla de rebaja." />
          </DialogHeader>
          <form onSubmit={(e) => handleSubmit(e)}>
            <DiscountFormFields />
            <div className="flex justify-end gap-2 pt-5 border-t border-border mt-6">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="brand" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? "Creando…" : "Crear descuento"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!toEdit} onOpenChange={(o) => !o && setToEdit(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <FormDialogHeader icon={Tag} title="Editar descuento" description={toEdit?.name} />
          </DialogHeader>
          <form onSubmit={(e) => handleSubmit(e, toEdit?.discountId)}>
            <DiscountFormFields discount={toEdit} />
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
            <AlertDialogTitle>¿Eliminar descuento?</AlertDialogTitle>
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
