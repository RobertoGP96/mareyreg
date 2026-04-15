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
import { toast } from "sonner";
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
  supplier: { name: string; taxId: string | null };
  warehouse: { name: string };
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

interface ProductOption {
  productId: number;
  name: string;
  unit: string;
  costPrice: unknown;
}

interface Props {
  orders: POItem[];
  suppliers: SupplierOption[];
  warehouses: WarehouseOption[];
  products: ProductOption[];
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

export function PurchaseOrderListClient({ orders, suppliers, warehouses, products }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [supplierId, setSupplierId] = useState<string>("");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [orderDate, setOrderDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [expectedDate, setExpectedDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [lines, setLines] = useState<POLineInput[]>([]);

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

  const resetForm = () => {
    setSupplierId("");
    setWarehouseId("");
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
      orderDate,
      expectedDate: expectedDate || undefined,
      notes: notes || undefined,
      lines,
    });
    setIsSubmitting(false);
    if (result.success) {
      setIsCreateOpen(false);
      resetForm();
      toast.success(`OC ${result.data.folio} creada`);
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
                  <span className="font-medium text-foreground">Total: ${String(o.total)}</span>
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
                {lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-6 space-y-1">
                      <Select
                        value={l.productId ? String(l.productId) : ""}
                        onValueChange={(v) => {
                          const p = products.find((x) => x.productId === Number(v));
                          updateLine(i, {
                            productId: Number(v),
                            unitCost: p?.costPrice != null ? Number(p.costPrice) : l.unitCost,
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
                    <div className="col-span-2 space-y-1">
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="Cant"
                        value={l.quantity || ""}
                        onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
                      />
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Costo"
                        value={l.unitCost || ""}
                        onChange={(e) => updateLine(i, { unitCost: Number(e.target.value) })}
                      />
                    </div>
                    <div className="col-span-1">
                      <Button type="button" variant="outline" size="icon" onClick={() => removeLine(i)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {lines.length > 0 && (
                <div className="mt-3 flex justify-end text-sm">
                  <span>Total: <span className="font-semibold">${total.toFixed(2)}</span></span>
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
