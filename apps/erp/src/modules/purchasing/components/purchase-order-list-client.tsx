"use client";

import { useMemo, useState } from "react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  FileText,
  Trash2,
  MoreHorizontal,
  Send,
  Ban,
  Loader2,
  PackageCheck,
} from "lucide-react";
import Link from "next/link";
import { toast } from "@/lib/toast";
import { ToastDetail, ToastLines } from "@/components/ui/toast-content";
import { toBaseQuantity, formatEquivalence } from "@/modules/inventory/lib/units";
import {
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  deletePurchaseOrder,
  type POLineInput,
} from "../actions/purchase-order-actions";

interface POItem {
  poId: number;
  folio: string;
  status: string;
  orderDate: Date;
  expectedDate: Date | null;
  total: unknown;
  totalBase: unknown;
  supplier: { name: string; taxId: string | null };
  warehouse: { name: string };
  currency: { code: string; symbol: string; decimalPlaces: number } | null;
  _count: { lines: number; receipts: number };
}

interface SupplierOption {
  supplierId: number;
  name: string;
  taxId: string | null;
}

interface WarehouseOption {
  warehouseId: number;
  name: string;
}

interface PresentationOption {
  presentationId: number;
  name: string;
  factor: number;
  isBase: boolean;
  piecesPerUnit: number | null;
}

interface ProductOption {
  productId: number;
  name: string;
  unit: string;
  costPrice: number | null;
  isCatchWeight: boolean;
  presentations: PresentationOption[];
}

interface CurrencyOption {
  currencyId: number;
  code: string;
  symbol: string;
  rateToBase: number | null;
}

interface Props {
  orders: POItem[];
  suppliers: SupplierOption[];
  warehouses: WarehouseOption[];
  products: ProductOption[];
  currencies: CurrencyOption[];
  baseCurrencyId: number;
  baseCurrencyCode: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  sent: "bg-blue-100 text-blue-800",
  partial: "bg-yellow-100 text-yellow-800",
  received: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviada",
  partial: "Parcial",
  received: "Recibida",
  cancelled: "Cancelada",
};

export function PurchaseOrderListClient({
  orders,
  suppliers,
  warehouses,
  products,
  currencies,
  baseCurrencyId,
  baseCurrencyCode,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preseleccion: USD si existe entre las monedas activas, si no la base.
  const defaultCurrencyId = useMemo(() => {
    const usd = currencies.find((c) => c.code === "USD");
    return usd ? usd.currencyId : baseCurrencyId;
  }, [currencies, baseCurrencyId]);

  const [supplierId, setSupplierId] = useState<string>("");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [currencyId, setCurrencyId] = useState<string>(String(defaultCurrencyId));
  const [orderDate, setOrderDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [expectedDate, setExpectedDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [lines, setLines] = useState<POLineInput[]>([]);

  const selectedCurrency = currencies.find((c) => c.currencyId === Number(currencyId));
  const isBaseCurrencySelected = Number(currencyId) === baseCurrencyId;

  const filtered = orders.filter(
    (o) =>
      o.folio.toLowerCase().includes(search.toLowerCase()) ||
      o.supplier.name.toLowerCase().includes(search.toLowerCase())
  );

  const addLine = () => setLines([...lines, { productId: 0, quantity: 1, unitCost: 0 }]);
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i: number, patch: Partial<POLineInput>) =>
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const total = lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);
  const totalBaseEquivalent =
    !isBaseCurrencySelected && selectedCurrency?.rateToBase ? total * selectedCurrency.rateToBase : null;

  const resetForm = () => {
    setSupplierId("");
    setWarehouseId("");
    setCurrencyId(String(defaultCurrencyId));
    setOrderDate(new Date().toISOString().slice(0, 10));
    setExpectedDate("");
    setNotes("");
    setLines([]);
  };

  const handleCreate = async () => {
    if (!supplierId || !warehouseId) {
      toast.error("Selecciona proveedor y almacen");
      return;
    }
    if (!lines.length) {
      toast.error("Agrega al menos una linea");
      return;
    }
    if (lines.some((l) => !l.productId || l.quantity <= 0)) {
      toast.error("Todas las lineas deben tener producto y cantidad valida");
      return;
    }
    setIsSubmitting(true);
    const result = await createPurchaseOrder({
      supplierId: Number(supplierId),
      warehouseId: Number(warehouseId),
      currencyId: currencyId ? Number(currencyId) : undefined,
      orderDate,
      expectedDate: expectedDate || undefined,
      notes: notes || undefined,
      lines,
    });
    setIsSubmitting(false);
    if (result.success) {
      setIsCreateOpen(false);
      resetForm();
      toast.success(`OC ${result.data.folio} creada`, {
        description: (
          <ToastLines>
            <ToastDetail
              label={`${lines.length} ${lines.length === 1 ? "linea" : "lineas"}`}
              value={`${total.toFixed(2)} ${selectedCurrency?.code ?? baseCurrencyCode}`}
              mono
            />
          </ToastLines>
        ),
      });
      router.refresh();
    } else toast.error(result.error);
  };

  const handleSend = async (poId: number) => {
    const result = await updatePurchaseOrderStatus(poId, "sent");
    if (result.success) {
      toast.success("OC enviada");
      router.refresh();
    } else toast.error(result.error);
  };

  const handleCancel = async (poId: number) => {
    const result = await updatePurchaseOrderStatus(poId, "cancelled");
    if (result.success) {
      toast.success("OC cancelada");
      router.refresh();
    } else toast.error(result.error);
  };

  const handleDelete = async (poId: number) => {
    const result = await deletePurchaseOrder(poId);
    if (result.success) {
      toast.success("OC eliminada");
      router.refresh();
    } else toast.error(result.error);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <InputGroup className="max-w-sm">
          <InputGroupAddon><Search className="w-4 h-4" /></InputGroupAddon>
          <InputGroupInput
            placeholder="Buscar OC o proveedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputGroup>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Nueva OC
        </Button>
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 ? (
          <EmptyState title="Sin ordenes de compra" description="Crea tu primera OC para registrar compras." />
        ) : (
          filtered.map((o) => (
            <div
              key={o.poId}
              className="bg-card border rounded-lg p-4 flex flex-wrap items-start gap-3 justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <Link href={`/purchase-orders/${o.poId}`} className="font-medium hover:underline">
                    {o.folio}
                  </Link>
                  <Badge className={STATUS_COLORS[o.status]}>{STATUS_LABELS[o.status]}</Badge>
                </div>
                <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  <span>Proveedor: {o.supplier.name}</span>
                  <span>Almacen: {o.warehouse.name}</span>
                  <span>Fecha: {new Date(o.orderDate).toLocaleDateString("es-ES")}</span>
                  <span>Lineas: {o._count.lines}</span>
                  <span>Recepciones: {o._count.receipts}</span>
                  <span className="font-medium text-foreground font-mono tabular-nums">
                    Total: {String(o.total)} {o.currency?.code ?? baseCurrencyCode}
                    {o.totalBase != null && o.currency && (
                      <span className="text-muted-foreground font-normal"> (≈ {String(o.totalBase)} {baseCurrencyCode})</span>
                    )}
                  </span>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {o.status === "draft" && (
                    <DropdownMenuItem onClick={() => handleSend(o.poId)}>
                      <Send className="w-4 h-4 mr-2" /> Enviar al proveedor
                    </DropdownMenuItem>
                  )}
                  {(o.status === "sent" || o.status === "partial") && (
                    <DropdownMenuItem asChild>
                      <Link href={`/purchase-orders/${o.poId}/receipt`}>
                        <PackageCheck className="w-4 h-4 mr-2" /> Registrar recepcion
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {o.status !== "received" && o.status !== "cancelled" && (
                    <DropdownMenuItem onClick={() => handleCancel(o.poId)}>
                      <Ban className="w-4 h-4 mr-2" /> Cancelar
                    </DropdownMenuItem>
                  )}
                  {o.status === "draft" && o._count.receipts === 0 && (
                    <DropdownMenuItem onClick={() => handleDelete(o.poId)}>
                      <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))
        )}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={(o) => { setIsCreateOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Nueva orden de compra</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Proveedor *</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.supplierId} value={String(s.supplierId)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Almacen destino *</Label>
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.warehouseId} value={String(w.warehouseId)}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Fecha de orden *</Label>
                <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fecha esperada</Label>
                <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Moneda</Label>
              <Select value={currencyId} onValueChange={setCurrencyId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.currencyId} value={String(c.currencyId)}>{c.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Lineas</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="w-3 h-3 mr-1" /> Agregar linea
                </Button>
              </div>
              <div className="space-y-2">
                {lines.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sin lineas. Agrega productos.</p>
                )}
                {lines.map((l, i) => {
                  const product = products.find((x) => x.productId === l.productId);
                  const activePresentations = product?.presentations ?? [];
                  const showPresentationPicker = activePresentations.length > 1;
                  const selectedPresentation = activePresentations.find(
                    (p) => p.presentationId === l.presentationId
                  );
                  const factor = selectedPresentation?.factor ?? 1;
                  const costLabel = product?.isCatchWeight
                    ? "Costo ($/kg)"
                    : selectedPresentation && !selectedPresentation.isBase
                    ? `Costo por ${selectedPresentation.name}`
                    : "Costo";

                  return (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end">
                      <div className={showPresentationPicker ? "col-span-4 space-y-1" : "col-span-6 space-y-1"}>
                        <Select
                          value={l.productId ? String(l.productId) : ""}
                          onValueChange={(v) => {
                            const p = products.find((x) => x.productId === Number(v));
                            const basePresentation = p?.presentations.find((pr) => pr.isBase);
                            updateLine(i, {
                              productId: Number(v),
                              unitCost: p?.costPrice != null ? p.costPrice : l.unitCost,
                              presentationId: basePresentation?.presentationId,
                            });
                          }}
                        >
                          <SelectTrigger><SelectValue placeholder="Producto" /></SelectTrigger>
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.productId} value={String(p.productId)}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {showPresentationPicker && (
                        <div className="col-span-2 space-y-1">
                          <Select
                            value={l.presentationId ? String(l.presentationId) : ""}
                            onValueChange={(v) => updateLine(i, { presentationId: Number(v) })}
                          >
                            <SelectTrigger><SelectValue placeholder="Presentacion" /></SelectTrigger>
                            <SelectContent>
                              {activePresentations.map((p) => (
                                <SelectItem key={p.presentationId} value={String(p.presentationId)}>
                                  {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className={showPresentationPicker ? "col-span-2 space-y-1" : "col-span-2 space-y-1"}>
                        <Input
                          type="number"
                          step={product?.isCatchWeight ? "1" : "0.01"}
                          min={product?.isCatchWeight ? "1" : "0.01"}
                          placeholder="Cant"
                          value={l.quantity || ""}
                          onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
                        />
                      </div>
                      <div className={showPresentationPicker ? "col-span-3 space-y-1" : "col-span-3 space-y-1"}>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={costLabel}
                          value={l.unitCost || ""}
                          onChange={(e) => updateLine(i, { unitCost: Number(e.target.value) })}
                        />
                      </div>
                      <div className="col-span-1">
                        <Button type="button" variant="outline" size="icon" onClick={() => removeLine(i)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                      {product?.isCatchWeight && (
                        <div className="col-span-12 -mt-1">
                          <p className="text-xs text-muted-foreground">
                            Total estimado = cajas × peso nominal × $/kg. El peso real se captura pieza
                            por pieza al recibir.
                          </p>
                        </div>
                      )}
                      {!product?.isCatchWeight && showPresentationPicker && factor !== 1 && l.quantity > 0 && (
                        <div className="col-span-12 -mt-1">
                          <p className="text-xs text-muted-foreground">
                            {formatEquivalence(
                              l.quantity,
                              factor,
                              selectedPresentation?.name ?? "",
                              product?.unit ?? ""
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {lines.length > 0 && (
                <div className="mt-3 flex flex-col items-end gap-0.5 text-sm">
                  <span className="font-mono tabular-nums">
                    Total: <span className="font-semibold">{total.toFixed(2)} {selectedCurrency?.code ?? baseCurrencyCode}</span>
                  </span>
                  {totalBaseEquivalent != null && (
                    <span className="text-xs text-muted-foreground font-mono tabular-nums">
                      ≈ {totalBaseEquivalent.toFixed(2)} {baseCurrencyCode} · tasa {selectedCurrency!.rateToBase!.toFixed(2)}
                    </span>
                  )}
                  {!isBaseCurrencySelected && selectedCurrency?.rateToBase == null && (
                    <span className="text-xs text-destructive">
                      No hay tasa de cambio configurada para {selectedCurrency?.code}.
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>

            <Button className="w-full" onClick={handleCreate} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Crear OC
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
