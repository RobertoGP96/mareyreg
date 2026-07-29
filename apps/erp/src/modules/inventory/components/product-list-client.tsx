"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
  History,
  Globe,
  ImagePlus,
  Tag,
  Layers,
  Scale,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { formatAmount } from "@/lib/format";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  getProductPriceHistoryAction,
  getProductCostInfoAction,
  type ProductPriceHistoryEntry,
  type ProductCostInfo,
} from "../actions/product-actions";
import type { PriceMarginData } from "../lib/margin";
import type { CurrencyOption } from "../queries/currency-context";
import { ProductDiscountsDialog } from "@/modules/webstore/components/product-discounts-dialog";
import { PresentationManagerDialog } from "./presentation-manager-dialog";
import { BulkPriceDialog } from "./bulk-price-dialog";
import { PRODUCT_IMAGE_ACCEPT_ATTR, PRODUCT_IMAGE_MAX_BYTES } from "../lib/schemas";
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
  salePrice: number | null;
  /** null = moneda base (CUP). */
  saleCurrencyId: number | null;
  /** Equivalente en CUP calculado server-side cuando el precio no está en base. */
  salePriceBase: number | null;
  webstoreEnabled: boolean;
  imageUrl: string | null;
  brand: string | null;
  supplier: string | null;
  supplierRef: string | null;
  isActive: boolean;
  description: string | null;
  notes: string | null;
  allowNegative: boolean;
  /** Producto de peso variable (ej. queso): se vende por kg pesado. */
  isCatchWeight: boolean;
}

const BASE_CURRENCY_VALUE = "base";

export function ProductListClient({
  products,
  isAdmin = false,
  currencies = [],
  baseCurrencyId,
  baseCode = "CUP",
}: {
  products: ProductItem[];
  isAdmin?: boolean;
  currencies?: CurrencyOption[];
  baseCurrencyId?: number;
  baseCode?: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toEdit, setToEdit] = useState<ProductItem | null>(null);
  const [toDelete, setToDelete] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [webstoreEnabled, setWebstoreEnabled] = useState(false);
  const [isCatchWeight, setIsCatchWeight] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<ProductItem | null>(null);
  const [history, setHistory] = useState<ProductPriceHistoryEntry[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [discountsProduct, setDiscountsProduct] = useState<{ id: number; name: string } | null>(null);
  const [presentationsProduct, setPresentationsProduct] = useState<ProductItem | null>(null);
  const [isBulkPriceOpen, setIsBulkPriceOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [costInfo, setCostInfo] = useState<ProductCostInfo | null>(null);
  const [isCostLoading, setIsCostLoading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const currencyCode = (currencyId: number | null) =>
    currencyId == null
      ? baseCode
      : currencies.find((c) => c.currencyId === currencyId)?.code ?? `#${currencyId}`;

  const currencyDecimals = (currencyId: number | null) =>
    currencyId == null
      ? 0
      : currencies.find((c) => c.currencyId === currencyId)?.decimalPlaces ?? 2;

  // Monedas seleccionables: la base va primero con value especial "base"
  // (el registro guarda null = CUP), las demás por currencyId.
  const selectableCurrencies = currencies.filter((c) => c.currencyId !== baseCurrencyId);

  const showMarginToast = (margin: PriceMarginData) => {
    if (margin.marginWarning === "negative") {
      toast.warning("Precio por debajo del costo de reposición", {
        description:
          margin.replacementMarginPct != null
            ? `Margen ${margin.replacementMarginPct.toFixed(1)}%`
            : undefined,
      });
    } else if (margin.marginWarning === "low" && margin.replacementMarginPct != null) {
      toast.warning(
        `Margen bajo: ${margin.replacementMarginPct.toFixed(1)}% sobre costo de reposición`
      );
    }
  };

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode?.toLowerCase().includes(search.toLowerCase()) ||
      p.category?.toLowerCase().includes(search.toLowerCase()) ||
      p.brand?.toLowerCase().includes(search.toLowerCase()) ||
      p.supplier?.toLowerCase().includes(search.toLowerCase())
  );

  const onImageChange = (f: File | null) => {
    if (!f) return;
    if (f.size > PRODUCT_IMAGE_MAX_BYTES) {
      toast.error("La imagen no puede pesar más de 5 MB");
      return;
    }
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
    setImageRemoved(false);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageRemoved(true);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>, editId?: number) => {
    e.preventDefault();
    // React anula e.currentTarget al salir del dispatch (primer await), hay
    // que capturar el form antes de subir la imagen.
    const form = e.currentTarget;
    setIsSubmitting(true);
    try {
      let uploadedImageUrl: string | undefined;
      if (imageFile) {
        setIsUploadingImage(true);
        try {
          const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const blob = await upload(`products/${Date.now()}-${safeName}`, imageFile, {
            access: "public",
            handleUploadUrl: "/api/products/upload",
            contentType: imageFile.type,
          });
          uploadedImageUrl = blob.url;
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Error al subir la imagen");
          return;
        } finally {
          setIsUploadingImage(false);
        }
      }

      const fd = new FormData(form);
      const rawSaleCurrency = fd.get("saleCurrencyId") as string | null;
      const data = {
        name: fd.get("name") as string,
        sku: (fd.get("sku") as string) || undefined,
        barcode: (fd.get("barcode") as string) || undefined,
        category: (fd.get("category") as string) || undefined,
        // Peso variable fuerza kg del lado del cliente (input deshabilitado),
        // pero se refuerza aquí por si el form llega a habilitarse de otro modo.
        unit: isCatchWeight ? "kg" : (fd.get("unit") as string),
        minStock: fd.get("minStock") ? Number(fd.get("minStock")) : 0,
        maxStock: fd.get("maxStock") ? Number(fd.get("maxStock")) : undefined,
        costPrice: fd.get("costPrice") ? Number(fd.get("costPrice")) : undefined,
        salePrice: fd.get("salePrice") ? Number(fd.get("salePrice")) : undefined,
        saleCurrencyId: rawSaleCurrency
          ? rawSaleCurrency === BASE_CURRENCY_VALUE
            ? null
            : Number(rawSaleCurrency)
          : undefined,
        allowNegative: isCatchWeight ? false : undefined,
        webstoreEnabled,
        isCatchWeight,
        // "" limpia la foto en el server (imageUrl || null); undefined la deja intacta.
        imageUrl: uploadedImageUrl ?? (imageRemoved ? "" : undefined),
        brand: (fd.get("brand") as string) || undefined,
        supplier: (fd.get("supplier") as string) || undefined,
        supplierRef: (fd.get("supplierRef") as string) || undefined,
        description: (fd.get("description") as string) || undefined,
        notes: (fd.get("notes") as string) || undefined,
      };

      const result = editId
        ? await updateProduct(editId, data)
        : await createProduct(data);

      if (result.success) {
        setIsCreateOpen(false);
        setToEdit(null);
        setImageFile(null);
        setImagePreview(null);
        setImageRemoved(false);
        toast.success(editId ? "Producto actualizado" : "Producto creado");
        showMarginToast(result.data);
        router.refresh();
      } else toast.error(result.error);
    } finally {
      setIsSubmitting(false);
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
    } else toast.error(result.error);
  };

  const getCategoryLabel = (value: string) =>
    PRODUCT_CATEGORIES.find((c) => c.value === value)?.label ?? value;

  const openEdit = (p: ProductItem) => {
    setToEdit(p);
    setWebstoreEnabled(p.webstoreEnabled);
    setIsCatchWeight(p.isCatchWeight);
    setImageFile(null);
    setImagePreview(p.imageUrl);
    setImageRemoved(false);
    setCostInfo(null);
    setIsCostLoading(true);
    getProductCostInfoAction(p.productId)
      .then((res) => {
        if (res.success) setCostInfo(res.data);
      })
      .finally(() => setIsCostLoading(false));
  };

  const openCreate = () => {
    setWebstoreEnabled(false);
    setIsCatchWeight(false);
    setImageFile(null);
    setImagePreview(null);
    setImageRemoved(false);
    setIsCreateOpen(true);
  };

  const openHistory = async (p: ProductItem) => {
    setHistoryProduct(p);
    setIsHistoryLoading(true);
    const result = await getProductPriceHistoryAction(p.productId);
    setIsHistoryLoading(false);
    if (result.success) setHistory(result.data);
    else toast.error(result.error);
  };

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
            <Select
              name="unit"
              value={isCatchWeight ? "kg" : undefined}
              defaultValue={product?.unit ?? "unidades"}
              disabled={isCatchWeight}
            >
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
        <Field
          label="Peso variable"
          icon={Scale}
          hint="El producto se vende por kg pesado en báscula (ej. queso). Fuerza unidad kg y desactiva stock negativo."
        >
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={isCatchWeight}
              onCheckedChange={(checked) => setIsCatchWeight(checked === true)}
              aria-label="Peso variable (se vende por kg pesado)"
            />
            Se vende por kg pesado
          </label>
        </Field>
      </FormSection>

      <FormSection icon={WarehouseIcon} title="Stock y costos" description="Niveles de inventario, costo y precio de venta.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Stock mínimo" icon={WarehouseIcon}>
            <Input name="minStock" type="number" step="0.01" defaultValue={product ? String(product.minStock) : "0"} />
          </Field>
          <Field label="Stock máximo" icon={WarehouseIcon} hint="Opcional.">
            <Input name="maxStock" type="number" step="0.01" defaultValue={product?.maxStock ? String(product.maxStock) : ""} placeholder="—" />
          </Field>
          <Field label="Costo unitario" icon={CircleDollarSign}>
            <Input name="costPrice" type="number" step="0.01" defaultValue={product?.costPrice ? String(product.costPrice) : ""} placeholder="$0.00" />
          </Field>
          <Field label="Precio de venta" icon={CircleDollarSign} hint="Precio base; los descuentos activos se aplican sobre este.">
            <div className="flex gap-2">
              <Input
                name="salePrice"
                type="number"
                step="0.01"
                defaultValue={product?.salePrice ? String(product.salePrice) : ""}
                placeholder="$0.00"
                className="flex-1"
              />
              <Select
                name="saleCurrencyId"
                defaultValue={
                  product?.saleCurrencyId != null ? String(product.saleCurrencyId) : BASE_CURRENCY_VALUE
                }
              >
                <SelectTrigger className="w-24 shrink-0" aria-label="Moneda del precio">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BASE_CURRENCY_VALUE}>{baseCode}</SelectItem>
                  {selectableCurrencies.map((c) => (
                    <SelectItem key={c.currencyId} value={String(c.currencyId)}>
                      {c.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Field>
        </div>
      </FormSection>

      <FormSection icon={Globe} title="Tienda en línea" description="Controla si este producto se vende en la tienda web y su foto.">
        <Field label="Disponible en tienda en línea" icon={Globe} hint="Si está apagado, el producto no aparece en el catálogo ni se puede vender por ese canal.">
          <div className="flex items-center gap-3">
            <Switch checked={webstoreEnabled} onCheckedChange={setWebstoreEnabled} aria-label="Disponible en tienda en línea" />
            <span className="text-sm text-muted-foreground">{webstoreEnabled ? "Sí" : "No"}</span>
          </div>
        </Field>
        <Field label="Foto del producto" icon={ImagePlus} hint="JPG, PNG o WEBP · máximo 5 MB. La tienda la obtiene directo de aquí.">
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="flex items-center gap-3 w-full rounded-md border-2 border-dashed border-border bg-muted/20 px-3 py-2 text-left text-sm hover:bg-muted/40 hover:border-[var(--brand)]/40 transition-colors"
          >
            {imagePreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagePreview} alt="Vista previa" className="h-12 w-12 rounded object-cover shrink-0" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded bg-muted shrink-0">
                <ImagePlus className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <span className="text-muted-foreground truncate">
              {imageFile ? imageFile.name : imagePreview ? "Toca para reemplazar la foto" : "Seleccionar foto…"}
            </span>
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept={PRODUCT_IMAGE_ACCEPT_ATTR}
            className="sr-only"
            onChange={(e) => onImageChange(e.target.files?.[0] ?? null)}
          />
          {imagePreview && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1.5 h-8 px-2 text-muted-foreground hover:text-destructive"
              onClick={removeImage}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Quitar foto
            </Button>
          )}
        </Field>
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
        title="Productos"
        description="Catálogo de productos, componentes y materiales del inventario."
        badge={`${products.length} productos`}
        actions={
          <>
            {isAdmin && (
              <Button variant="outline" onClick={() => setIsBulkPriceOpen(true)}>
                <CircleDollarSign className="h-4 w-4" />
                Ajustar precios
              </Button>
            )}
            <Button variant="brand" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Nuevo producto
            </Button>
          </>
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
                    {p.webstoreEnabled && (
                      <Badge variant="brand">
                        <Globe className="h-3 w-3" /> Tienda en línea
                      </Badge>
                    )}
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
                    {p.salePrice != null && p.salePrice > 0 && (
                      <span>
                        Venta:{" "}
                        <span className="font-medium font-mono tabular-nums text-foreground">
                          {formatAmount(p.salePrice, currencyDecimals(p.saleCurrencyId))}
                          {p.saleCurrencyId != null && ` ${currencyCode(p.saleCurrencyId)}`}
                        </span>
                        {p.salePriceBase != null && (
                          <span className="text-muted-foreground">
                            {" "}≈ {formatAmount(p.salePriceBase, 0)} {baseCode}
                          </span>
                        )}
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
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => openEdit(p)}>
                      <SquarePen className="h-4 w-4" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openHistory(p)}>
                      <History className="h-4 w-4" /> Historial de precios
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setPresentationsProduct(p)}>
                      <Layers className="h-4 w-4" /> Presentaciones
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDiscountsProduct({ id: p.productId, name: p.name })}>
                      <Tag className="h-4 w-4" /> Descuentos
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
                {isSubmitting ? (isUploadingImage ? "Subiendo foto…" : "Creando…") : "Crear producto"}
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
            <div className="mt-6 rounded-lg border border-border bg-muted/20 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Costos y margen
              </p>
              {isCostLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando costos…
                </div>
              ) : costInfo ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  <span className="text-muted-foreground">
                    Costo de reposición:{" "}
                    <span className="font-mono tabular-nums text-foreground">
                      {costInfo.replacementCost != null && costInfo.replacementCostCurrencyCode
                        ? `${formatAmount(costInfo.replacementCost)} ${costInfo.replacementCostCurrencyCode}`
                        : "—"}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    Costo {costInfo.baseCode} a tasa vigente:{" "}
                    <span className="font-mono tabular-nums text-foreground">
                      {costInfo.replacementCostBase != null
                        ? formatAmount(costInfo.replacementCostBase, 0)
                        : "—"}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    Costo contable {costInfo.baseCode} (promedio):{" "}
                    <span className="font-mono tabular-nums text-foreground">
                      {costInfo.accountingCostBase != null
                        ? formatAmount(costInfo.accountingCostBase, 0)
                        : "—"}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    Margen del precio vigente:{" "}
                    <span
                      className={`font-mono tabular-nums ${
                        costInfo.replacementMarginPct != null && costInfo.replacementMarginPct < 0
                          ? "text-destructive"
                          : "text-foreground"
                      }`}
                    >
                      {costInfo.replacementMarginPct != null
                        ? `${formatAmount(costInfo.replacementMarginPct, 1)}%`
                        : "—"}
                    </span>
                  </span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin datos de costo registrados.</p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-5 border-t border-border mt-6">
              <Button type="button" variant="outline" onClick={() => setToEdit(null)}>
                Cancelar
              </Button>
              <Button type="submit" variant="brand" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? (isUploadingImage ? "Subiendo foto…" : "Actualizando…") : "Actualizar"}
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

      <Dialog open={!!historyProduct} onOpenChange={(o) => !o && setHistoryProduct(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <FormDialogHeader
              icon={History}
              title="Historial de precios"
              description={historyProduct?.name}
            />
          </DialogHeader>
          {isHistoryLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : history.length > 0 ? (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {history.map((h) => (
                <div key={h.historyId} className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mb-1.5">
                    <span>{new Date(h.changedAt).toLocaleString("es-MX")}</span>
                    <span>{h.changedByName ?? "Sistema"}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono tabular-nums">
                    {(h.oldCostPrice !== h.newCostPrice) && (
                      <span>Costo: {h.oldCostPrice ?? "—"} → {h.newCostPrice ?? "—"}</span>
                    )}
                    {(h.oldSalePrice !== h.newSalePrice) && (
                      <span>Venta: {h.oldSalePrice ?? "—"} → {h.newSalePrice ?? "—"}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Sin cambios registrados" description="Este producto no tiene historial de precios." />
          )}
        </DialogContent>
      </Dialog>

      <ProductDiscountsDialog
        productId={discountsProduct?.id ?? null}
        productName={discountsProduct?.name}
        onOpenChange={(open) => !open && setDiscountsProduct(null)}
      />

      <PresentationManagerDialog
        productId={presentationsProduct?.productId ?? null}
        productName={presentationsProduct?.name}
        productUnit={presentationsProduct?.unit}
        productIsCatchWeight={presentationsProduct?.isCatchWeight}
        currencies={currencies}
        baseCurrencyId={baseCurrencyId}
        baseCode={baseCode}
        onOpenChange={(open) => !open && setPresentationsProduct(null)}
      />

      {isAdmin && (
        <BulkPriceDialog open={isBulkPriceOpen} onOpenChange={setIsBulkPriceOpen} />
      )}
    </div>
  );
}
