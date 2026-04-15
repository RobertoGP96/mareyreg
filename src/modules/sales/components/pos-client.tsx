"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Plus, Trash2, ShoppingCart, Loader2, Search, Barcode } from "lucide-react";
import { toast } from "sonner";
import { createInvoice } from "../actions/invoice-actions";

interface ProductOption {
  productId: number;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit: string;
  salePrice: unknown;
  costPrice: unknown;
  stock: number;
}

interface CustomerOption {
  customerId: number;
  name: string;
  customerType: string;
}

interface Props {
  products: ProductOption[];
  customers: CustomerOption[];
  warehouseId: number;
  warehouseName: string;
}

interface CartLine {
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  stock: number;
}

const PAYMENT_METHODS = [
  { value: "cash", label: "Efectivo" },
  { value: "card", label: "Tarjeta" },
  { value: "transfer", label: "Transferencia" },
  { value: "credit", label: "Credito" },
];

export function PosClient({ products, customers, warehouseId, warehouseName }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState<string>(
    customers[0] ? String(customers[0].customerId) : ""
  );
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashReceived, setCashReceived] = useState<string>("");
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const results = useMemo(() => {
    if (!search.trim()) return products.slice(0, 20);
    const q = search.toLowerCase();
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [search, products]);

  const addProduct = (p: ProductOption) => {
    const existing = cart.find((l) => l.productId === p.productId);
    const price = p.salePrice != null ? Number(p.salePrice) : 0;
    if (existing) {
      if (existing.quantity + 1 > p.stock) {
        toast.error(`Sin stock suficiente de ${p.name}`);
        return;
      }
      setCart(cart.map((l) => (l.productId === p.productId ? { ...l, quantity: l.quantity + 1 } : l)));
    } else {
      if (p.stock < 1) {
        toast.error(`Sin stock de ${p.name}`);
        return;
      }
      setCart([
        ...cart,
        {
          productId: p.productId,
          name: p.name,
          quantity: 1,
          unitPrice: price,
          unit: p.unit,
          stock: p.stock,
        },
      ]);
    }
    setSearch("");
  };

  const handleBarcode = (code: string) => {
    const exact = products.find((p) => p.barcode === code || p.sku === code);
    if (exact) addProduct(exact);
    else toast.error("Producto no encontrado");
  };

  const updateQty = (productId: number, qty: number) => {
    setCart(
      cart.map((l) => {
        if (l.productId !== productId) return l;
        if (qty > l.stock) {
          toast.error(`Maximo disponible: ${l.stock}`);
          return l;
        }
        return { ...l, quantity: Math.max(1, qty) };
      })
    );
  };

  const updatePrice = (productId: number, price: number) => {
    setCart(cart.map((l) => (l.productId === productId ? { ...l, unitPrice: Math.max(0, price) } : l)));
  };

  const removeLine = (productId: number) => {
    setCart(cart.filter((l) => l.productId !== productId));
  };

  const total = cart.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const change =
    paymentMethod === "cash" && cashReceived ? Math.max(0, Number(cashReceived) - total) : 0;

  const handleCheckout = async () => {
    if (!cart.length) {
      toast.error("Carrito vacio");
      return;
    }
    if (!customerId) {
      toast.error("Selecciona un cliente");
      return;
    }
    setIsSubmitting(true);
    const result = await createInvoice({
      customerId: Number(customerId),
      warehouseId,
      channel: "pos",
      issueDate: new Date().toISOString(),
      lines: cart.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
      immediatePayment:
        paymentMethod === "credit"
          ? undefined
          : {
              amount: total,
              paymentMethod,
            },
    });
    setIsSubmitting(false);
    if (result.success) {
      toast.success(`Factura ${result.data.folio} emitida`);
      setCart([]);
      setCashReceived("");
      setIsCheckoutOpen(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
      {/* Buscador + resultados */}
      <div className="lg:col-span-2 space-y-3">
        <div>
          <InputGroup>
            <InputGroupAddon><Barcode className="w-4 h-4" /></InputGroupAddon>
            <InputGroupInput
              autoFocus
              placeholder="Escanear codigo o buscar producto (Enter para confirmar barcode)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && search.trim()) {
                  e.preventDefault();
                  handleBarcode(search.trim());
                }
              }}
            />
          </InputGroup>
          <p className="text-xs text-muted-foreground mt-1">
            Almacen: <span className="font-medium">{warehouseName}</span>
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {results.map((p) => (
            <button
              key={p.productId}
              type="button"
              onClick={() => addProduct(p)}
              className="border rounded-lg p-3 text-left hover:bg-accent disabled:opacity-40"
              disabled={p.stock < 1}
            >
              <p className="font-medium text-sm line-clamp-2">{p.name}</p>
              <div className="flex justify-between items-center mt-1 text-xs text-muted-foreground">
                <span>Stock: {p.stock}</span>
                <span className="font-semibold text-foreground">
                  ${p.salePrice != null ? String(p.salePrice) : "-"}
                </span>
              </div>
              {p.sku && <p className="text-[10px] text-muted-foreground truncate">{p.sku}</p>}
            </button>
          ))}
        </div>
        {results.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin resultados.</p>
        )}
      </div>

      {/* Carrito */}
      <div className="space-y-3 bg-card border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" /> Carrito
          </h2>
          <Badge variant="outline">{cart.length} items</Badge>
        </div>

        <div className="space-y-2">
          <Label>Cliente</Label>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.customerId} value={String(c.customerId)}>
                  {c.name} ({c.customerType === "wholesale" ? "Mayor" : "Menor"})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {cart.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Sin productos. Busca o escanea para agregar.
            </p>
          )}
          {cart.map((l) => (
            <div key={l.productId} className="border rounded p-2 space-y-1">
              <div className="flex justify-between items-start gap-2">
                <p className="text-sm font-medium line-clamp-2">{l.name}</p>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeLine(l.productId)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  value={l.quantity}
                  onChange={(e) => updateQty(l.productId, Number(e.target.value))}
                  className="h-8 text-sm"
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={l.unitPrice}
                  onChange={(e) => updatePrice(l.productId, Number(e.target.value))}
                  className="h-8 text-sm"
                />
                <div className="flex items-center justify-end text-sm font-medium pr-1">
                  ${(l.quantity * l.unitPrice).toFixed(2)}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t space-y-2">
          <div className="flex justify-between text-lg font-semibold">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
          <Button
            className="w-full"
            size="lg"
            disabled={!cart.length}
            onClick={() => setIsCheckoutOpen(true)}
          >
            Cobrar
          </Button>
        </div>
      </div>

      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cobrar ${total.toFixed(2)}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Metodo de pago</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {paymentMethod === "cash" && (
              <div className="space-y-2">
                <Label>Efectivo recibido</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={total}
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                />
                {cashReceived && (
                  <p className="text-sm">Cambio: <span className="font-semibold">${change.toFixed(2)}</span></p>
                )}
              </div>
            )}
            {paymentMethod === "credit" && (
              <p className="text-sm text-muted-foreground">
                La venta se registrara como cuenta por cobrar al cliente.
              </p>
            )}
            <Button className="w-full" size="lg" onClick={handleCheckout} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Confirmar venta
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
