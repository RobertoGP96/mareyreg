"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { toast } from "@/lib/toast";
import { ToastDetail, ToastLines } from "@/components/ui/toast-content";
import { createInvoice } from "../actions/invoice-actions";
import { getSuggestedUnitPriceAction } from "@/modules/inventory/actions/pricing-actions";

interface ProductPresentationOption {
  presentationId: number;
  name: string;
  factor: number;
  retailPrice: number;
  wholesalePrice: number | null;
  barcode: string | null;
  sku: string | null;
  isBase: boolean;
}

interface ProductOption {
  productId: number;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit: string;
  salePrice: number | null;
  stock: number;
  presentations: ProductPresentationOption[];
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
  presentationId: number | null;
  presentationName: string | null;
  factor: number;
  name: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  /** Stock disponible en unidad base del producto (no de la presentación). */
  stock: number;
  priceEdited: boolean;
}

function cartLineKey(productId: number, presentationId: number | null): string {
  return `${productId}:${presentationId ?? "base"}`;
}

/** Precio de una presentación según el tipo de cliente: mayoreo usa wholesalePrice si existe. */
function presentationPriceFor(
  presentation: ProductPresentationOption,
  customerType: string | undefined
): number {
  if (customerType === "wholesale") {
    return presentation.wholesalePrice ?? presentation.retailPrice;
  }
  return presentation.retailPrice;
}

/** Suma en unidad base de todas las líneas de un mismo producto en el carrito. */
function baseQtyInCart(cart: CartLine[], productId: number): number {
  return cart
    .filter((l) => l.productId === productId)
    .reduce((sum, l) => sum + l.quantity * l.factor, 0);
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
  // Producto con >1 presentación activa esperando que el cajero elija cuál agregar.
  const [pendingProduct, setPendingProduct] = useState<ProductOption | null>(null);

  const selectedCustomer = customers.find((c) => String(c.customerId) === customerId);
  const prevCustomerTypeRef = useRef<string | undefined>(selectedCustomer?.customerType);

  // Token por linea: cada solicitud de precio sugerido incrementa el contador de su
  // linea; solo la respuesta cuyo token coincide con el actual se aplica (descarta
  // respuestas obsoletas si la cantidad vuelve a cambiar antes de que resuelva).
  const priceRequestTokens = useRef<Map<string, number>>(new Map());
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const requestSuggestedPrice = (
    productId: number,
    presentationId: number | null,
    quantity: number
  ) => {
    const key = cartLineKey(productId, presentationId);
    const token = (priceRequestTokens.current.get(key) ?? 0) + 1;
    priceRequestTokens.current.set(key, token);
    const custId = customerId ? Number(customerId) : undefined;

    getSuggestedUnitPriceAction(productId, quantity, custId, presentationId ?? undefined).then(
      (result) => {
        if (priceRequestTokens.current.get(key) !== token) return; // respuesta obsoleta
        if (!result.success) return;
        setCart((prev) =>
          prev.map((l) =>
            l.productId === productId &&
            l.presentationId === presentationId &&
            !l.priceEdited &&
            l.quantity === quantity &&
            l.unitPrice !== result.data.finalPrice
              ? { ...l, unitPrice: result.data.finalPrice }
              : l
          )
        );
      }
    );
  };

  // Si el cliente seleccionado cambia de tipo (retail <-> wholesale), re-sugiere
  // el precio de cada línea no editada manualmente contra su presentación.
  useEffect(() => {
    const prevType = prevCustomerTypeRef.current;
    const nextType = selectedCustomer?.customerType;
    prevCustomerTypeRef.current = nextType;
    if (prevType === nextType) return;
    for (const line of cart) {
      if (line.priceEdited) continue;
      requestSuggestedPrice(line.productId, line.presentationId, line.quantity);
    }
    // Solo debe correr cuando cambia el tipo de cliente, no en cada cambio de carrito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomer?.customerType]);

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

  const addLine = (p: ProductOption, presentation: ProductPresentationOption | null) => {
    const presentationId = presentation?.isBase ? null : presentation?.presentationId ?? null;
    const factor = presentation?.factor ?? 1;
    const price = presentation
      ? presentationPriceFor(presentation, selectedCustomer?.customerType)
      : p.salePrice != null
        ? Number(p.salePrice)
        : 0;

    const key = cartLineKey(p.productId, presentationId);
    const existing = cart.find((l) => cartLineKey(l.productId, l.presentationId) === key);
    const nextQty = existing ? existing.quantity + 1 : 1;
    const projectedBaseQty = baseQtyInCart(cart, p.productId) - (existing ? existing.quantity * factor : 0) + nextQty * factor;

    if (projectedBaseQty > p.stock) {
      toast.error(`Sin stock suficiente de ${p.name}`);
      return;
    }

    if (existing) {
      // Cualquier alta o incremento por el buscador resetea la edicion manual: el
      // cajero espera ver de nuevo el precio sugerido para la nueva cantidad.
      setCart(
        cart.map((l) =>
          cartLineKey(l.productId, l.presentationId) === key
            ? { ...l, quantity: l.quantity + 1, priceEdited: false }
            : l
        )
      );
    } else {
      setCart([
        ...cart,
        {
          productId: p.productId,
          presentationId,
          presentationName: presentation && !presentation.isBase ? presentation.name : null,
          factor,
          name: p.name,
          quantity: 1,
          unitPrice: price,
          unit: p.unit,
          stock: p.stock,
          priceEdited: false,
        },
      ]);
    }
    setSearch("");
    setPendingProduct(null);

    // Precio sugerido con descuentos activos (no bloquea el flujo; el cajero puede editarlo después).
    requestSuggestedPrice(p.productId, presentationId, nextQty);
  };

  const addProduct = (p: ProductOption) => {
    const activePresentations = p.presentations;
    if (activePresentations.length > 1) {
      setPendingProduct(p);
      return;
    }
    const onlyPresentation = activePresentations[0] ?? null;
    addLine(p, onlyPresentation);
  };

  const handleBarcode = (code: string) => {
    const exact = products.find((p) => p.barcode === code || p.sku === code);
    if (exact) {
      addProduct(exact);
      return;
    }
    for (const p of products) {
      const presentation = p.presentations.find((pr) => pr.barcode === code || pr.sku === code);
      if (presentation) {
        addLine(p, presentation);
        return;
      }
    }
    toast.error("Producto no encontrado");
  };

  const updateQty = (productId: number, presentationId: number | null, qty: number) => {
    const clampedQty = Math.max(1, qty);
    let shouldRequestPrice = false;
    const key = cartLineKey(productId, presentationId);
    setCart(
      cart.map((l) => {
        if (cartLineKey(l.productId, l.presentationId) !== key) return l;
        const projectedBaseQty = baseQtyInCart(cart, productId) - l.quantity * l.factor + clampedQty * l.factor;
        if (projectedBaseQty > l.stock) {
          toast.error(`Maximo disponible: ${l.stock} ${l.unit}`);
          return l;
        }
        shouldRequestPrice = !l.priceEdited;
        return { ...l, quantity: clampedQty };
      })
    );

    // Re-evalua el descuento por volumen con la nueva cantidad, con debounce corto
    // para no disparar una server action por cada tap de +/-. Solo si el cajero no
    // edito el precio manualmente en esta linea.
    if (shouldRequestPrice) {
      const existingTimer = debounceTimers.current.get(key);
      if (existingTimer) clearTimeout(existingTimer);
      const timer = setTimeout(() => {
        debounceTimers.current.delete(key);
        requestSuggestedPrice(productId, presentationId, clampedQty);
      }, 300);
      debounceTimers.current.set(key, timer);
    }
  };

  const updatePrice = (productId: number, presentationId: number | null, price: number) => {
    const key = cartLineKey(productId, presentationId);
    setCart(
      cart.map((l) =>
        cartLineKey(l.productId, l.presentationId) === key
          ? { ...l, unitPrice: Math.max(0, price), priceEdited: true }
          : l
      )
    );
    // El cajero tomo control del precio: cancela cualquier sugerencia pendiente.
    const existingTimer = debounceTimers.current.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
      debounceTimers.current.delete(key);
    }
    priceRequestTokens.current.set(key, (priceRequestTokens.current.get(key) ?? 0) + 1);
  };

  const removeLine = (productId: number, presentationId: number | null) => {
    const key = cartLineKey(productId, presentationId);
    setCart(cart.filter((l) => cartLineKey(l.productId, l.presentationId) !== key));
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
        presentationId: l.presentationId ?? undefined,
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
      toast.success(`Factura ${result.data.folio} emitida`, {
        description: (
          <ToastLines>
            <ToastDetail
              label={`${cart.length} ${cart.length === 1 ? "artículo" : "artículos"}`}
              value={`$${total.toFixed(2)}`}
              mono
            />
            {change > 0 && (
              <ToastDetail label="Cambio" value={`$${change.toFixed(2)}`} mono />
            )}
          </ToastLines>
        ),
      });
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
          {results.map((p) => {
            // Mayor presentación no-base activa (mayor factor), para mostrar
            // disponibilidad también en esa unidad, ej. "48 lata · 2 Caja 24".
            const largestPresentation = p.presentations
              .filter((pr) => !pr.isBase && pr.factor > 0)
              .sort((a, b) => b.factor - a.factor)[0];
            const displayPrice = p.salePrice != null ? p.salePrice : p.presentations.find((pr) => pr.isBase)?.retailPrice;
            return (
              <button
                key={p.productId}
                type="button"
                onClick={() => addProduct(p)}
                className="border rounded-lg p-3 text-left hover:bg-accent disabled:opacity-40"
                disabled={p.stock < 1}
              >
                <p className="font-medium text-sm line-clamp-2">{p.name}</p>
                <div className="flex justify-between items-center mt-1 text-xs text-muted-foreground">
                  <span>
                    {p.stock} {p.unit}
                    {largestPresentation && (
                      <> · {Math.floor(p.stock / largestPresentation.factor)} {largestPresentation.name}</>
                    )}
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-foreground">
                    ${displayPrice != null ? displayPrice.toFixed(2) : "-"}
                  </span>
                </div>
                {p.sku && <p className="text-[10px] text-muted-foreground truncate">{p.sku}</p>}
              </button>
            );
          })}
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
          {cart.map((l) => {
            const key = cartLineKey(l.productId, l.presentationId);
            return (
              <div key={key} className="border rounded p-2 space-y-1">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium line-clamp-2">{l.name}</p>
                    {l.presentationName && (
                      <p className="text-[11px] text-muted-foreground">{l.presentationName}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeLine(l.productId, l.presentationId)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <Input
                    type="number"
                    min="1"
                    step="0.01"
                    value={l.quantity}
                    onChange={(e) => updateQty(l.productId, l.presentationId, Number(e.target.value))}
                    className="h-8 text-sm font-mono tabular-nums"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={l.unitPrice}
                    onChange={(e) => updatePrice(l.productId, l.presentationId, Number(e.target.value))}
                    className="h-8 text-sm font-mono tabular-nums"
                  />
                  <div className="flex items-center justify-end text-sm font-medium font-mono tabular-nums pr-1">
                    ${(l.quantity * l.unitPrice).toFixed(2)}
                  </div>
                </div>
              </div>
            );
          })}
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

      <Dialog open={pendingProduct != null} onOpenChange={(open) => !open && setPendingProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {pendingProduct?.presentations.map((pr) => {
              const price = presentationPriceFor(pr, selectedCustomer?.customerType);
              return (
                <button
                  key={pr.presentationId}
                  type="button"
                  onClick={() => addLine(pendingProduct, pr)}
                  className="min-h-11 border rounded-lg p-3 text-left hover:bg-accent flex flex-col gap-0.5"
                >
                  <span className="text-sm font-medium">{pr.name}</span>
                  <span className="text-sm font-mono tabular-nums text-muted-foreground">
                    ${price.toFixed(2)}
                  </span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
