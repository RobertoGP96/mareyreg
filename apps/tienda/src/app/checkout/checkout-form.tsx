"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Banknote,
  CreditCard,
  Loader2,
  ShoppingBag,
  Store,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { submitOrder } from "@/app/actions/order-actions";
import { computeTotals, lineTotal, SHIPPING_COST } from "@/lib/cart-totals";
import { fmt } from "@/lib/format";
import { cartCount, cartLines, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Delivery = "domicilio" | "recogida";
type Payment = "efectivo" | "transferencia";
type FieldKey = "name" | "phone" | "email" | "address" | "cart";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LABEL_CLASS = "mb-1.5 block text-[12px] font-semibold text-slate-500";

function OptionRow({
  title,
  subtitle,
  active,
  onSelect,
  icon: Icon,
}: {
  title: string;
  subtitle: string;
  active: boolean;
  onSelect: () => void;
  icon?: LucideIcon;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "flex w-full items-center gap-3.5 rounded-md border-[1.5px] px-4 py-3.5 text-left transition-colors duration-150",
        active
          ? "border-navy-700 bg-tint"
          : "border-line bg-canvas hover:border-navy-700"
      )}
    >
      {Icon && (
        <span
          className={cn(
            "flex h-9 w-9 flex-none items-center justify-center rounded-full",
            active
              ? "bg-canvas text-navy-700 shadow-card"
              : "bg-surface text-slate-500"
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={1.8} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-ink">
          {title}
        </span>
        <span className="tabular mt-0.5 block text-[12px] text-slate-500">
          {subtitle}
        </span>
      </span>
    </button>
  );
}

export function CheckoutForm() {
  const router = useRouter();
  const { state, addOrder, clearCart, setProfile, removePieces, showToast } =
    useStore();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [delivery, setDelivery] = useState<Delivery>("domicilio");
  const [payment, setPayment] = useState<Payment>("efectivo");
  const [sending, setSending] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const [error, setError] = useState<{
    field: FieldKey;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!state.hydrated || prefilled) return;
    setPrefilled(true);
    if (!state.profile) return;
    setName((prev) => prev || state.profile?.name || "");
    setPhone((prev) => prev || state.profile?.phone || "");
    setEmail((prev) => prev || state.profile?.email || "");
    setAddress((prev) => prev || state.profile?.address || "");
  }, [state.hydrated, state.profile, prefilled]);

  const lines = cartLines(state);
  const itemsCount = cartCount(state);
  const totals = computeTotals(lines, {
    couponApplied: state.couponApplied,
    pickup: delivery === "recogida",
  });
  const currency = state.currency;
  // Solo las líneas catch-weight SIN piezas elegidas tienen precio estimado:
  // con piezas el peso ya es real y el total no se ajusta.
  const hasEstimatedLines = lines.some(
    (line) => line.isCatchWeight && !line.pieces?.length
  );

  const fail = (field: FieldKey, message: string) => {
    setError({ field, message });
    showToast(message);
  };

  const fieldError = (field: FieldKey) =>
    error?.field === field ? (
      <p className="mt-1.5 text-[12px] text-danger">{error.message}</p>
    ) : null;

  const fieldClass = (field: FieldKey) =>
    cn(error?.field === field && "border-danger");

  const handleSubmit = async () => {
    if (sending) return;
    if (!name.trim()) {
      fail("name", "Completa tu nombre");
      return;
    }
    if (!phone.trim()) {
      fail("phone", "Escribe tu teléfono");
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      fail("email", "Escribe un correo válido");
      return;
    }
    if (delivery === "domicilio" && !address.trim()) {
      fail("address", "Escribe tu dirección de entrega");
      return;
    }
    if (lines.length === 0) {
      fail("cart", "Tu carrito está vacío");
      return;
    }

    setError(null);
    setSending(true);
    try {
      const result = await submitOrder({
        customer: {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          ...(delivery === "domicilio" ? { address: address.trim() } : {}),
        },
        lines: lines.map((line) => ({
          sku: line.sku,
          quantity: line.qty,
          unitPrice: line.unitPrice,
          ...(line.pieces?.length
            ? { pieceIds: line.pieces.map((p) => p.pieceId) }
            : {}),
        })),
        delivery,
        payment,
        couponApplied: state.couponApplied,
        total: totals.total,
        currency: currency.code,
      });

      if (!result.success) {
        if (result.unavailablePieceIds?.length) {
          // Alguna pieza se vendió entre el carrito y el checkout: se quitan
          // del carrito (el resto se conserva) y se pide re-elegir.
          removePieces(result.unavailablePieceIds);
          showToast(result.error);
          router.push("/carrito");
          return;
        }
        showToast(result.error);
        return;
      }

      addOrder({
        no: result.data.orderNo,
        dateIso: new Date().toISOString(),
        itemsCount,
        total: totals.total,
        status:
          result.data.status === "processed"
            ? "En preparación"
            : result.data.status === "awaiting_weighing"
              ? "Por pesar"
              : "En revisión",
        // Copia inmutable de lo comprado: el carrito se vacía justo después y
        // sin esto la ficha del pedido no podría decir qué se llevó.
        lines: lines.map((line) => ({
          sku: line.sku,
          name: line.name,
          presentationName: line.presentationName,
          qty: line.qty,
          unitPrice: line.unitPrice,
          total: lineTotal(line),
          ...(line.isCatchWeight ? { isCatchWeight: true } : {}),
        })),
        subtotal: totals.subtotal,
        shipping: totals.shipping,
        discount: totals.discount,
        delivery,
        payment: payment === "efectivo" ? "Efectivo" : "Transferencia",
        ...(delivery === "domicilio" && address.trim()
          ? { address: address.trim() }
          : {}),
      });
      if (state.profile) {
        setProfile({
          ...state.profile,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          ...(delivery === "domicilio" ? { address: address.trim() } : {}),
        });
      }
      clearCart();
      router.push(
        `/pedido-confirmado?no=${encodeURIComponent(result.data.orderNo)}&status=${result.data.status}`
      );
    } finally {
      setSending(false);
    }
  };

  const header = (
    <ScreenHeader
      eyebrow="Paso final"
      title="Finalizar compra"
      backHref="/carrito"
    />
  );

  if (state.hydrated && lines.length === 0) {
    return (
      <div className="flex flex-1 flex-col">
        {header}
        <EmptyState
          icon={ShoppingBag}
          eyebrow="Sin artículos"
          title="Tu carrito está vacío"
          description="Explora el catálogo y añade productos."
          ctaLabel="Ir al catálogo"
          ctaHref="/catalogo"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {header}

      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5 px-5 pb-16 md:px-6">
        <section className="rounded-lg bg-canvas p-5 shadow-card md:p-6">
          <p className="eyebrow">Paso 1</p>
          <h2 className="mt-1.5 text-[15px] font-semibold text-ink">
            Datos de contacto
          </h2>
          <div className="mt-5 flex flex-col gap-4">
            <div>
              <label htmlFor="checkout-name" className={LABEL_CLASS}>
                Nombre y apellidos
              </label>
              <Input
                id="checkout-name"
                variant="box"
                className={fieldClass("name")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre y apellidos"
                autoComplete="name"
                aria-invalid={error?.field === "name" || undefined}
              />
              {fieldError("name")}
            </div>
            <div>
              <label htmlFor="checkout-phone" className={LABEL_CLASS}>
                Teléfono
              </label>
              <Input
                id="checkout-phone"
                variant="box"
                className={fieldClass("phone")}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Teléfono"
                type="tel"
                autoComplete="tel"
                aria-invalid={error?.field === "phone" || undefined}
              />
              {fieldError("phone")}
            </div>
            <div>
              <label htmlFor="checkout-email" className={LABEL_CLASS}>
                Correo electrónico
              </label>
              <Input
                id="checkout-email"
                variant="box"
                className={fieldClass("email")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Correo electrónico"
                type="email"
                autoComplete="email"
                aria-invalid={error?.field === "email" || undefined}
              />
              {fieldError("email")}
            </div>
            <div>
              <label htmlFor="checkout-address" className={LABEL_CLASS}>
                Dirección de entrega
              </label>
              <Input
                id="checkout-address"
                variant="box"
                className={fieldClass("address")}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Dirección de entrega"
                autoComplete="street-address"
                aria-invalid={error?.field === "address" || undefined}
              />
              {fieldError("address")}
            </div>
          </div>
        </section>

        <section className="rounded-lg bg-canvas p-5 shadow-card md:p-6">
          <p className="eyebrow">Paso 2</p>
          <h2 className="mt-1.5 text-[15px] font-semibold text-ink">Entrega</h2>
          <div className="mt-5 flex flex-col gap-3">
            <OptionRow
              title="A domicilio"
              subtitle={`${fmt(SHIPPING_COST, currency)} · 24–48 h`}
              active={delivery === "domicilio"}
              onSelect={() => setDelivery("domicilio")}
              icon={Truck}
            />
            <OptionRow
              title="Recoger en tienda"
              subtitle="Gratis · hoy mismo"
              active={delivery === "recogida"}
              onSelect={() => setDelivery("recogida")}
              icon={Store}
            />
          </div>
        </section>

        <section className="rounded-lg bg-canvas p-5 shadow-card md:p-6">
          <p className="eyebrow">Paso 3</p>
          <h2 className="mt-1.5 text-[15px] font-semibold text-ink">Pago</h2>
          <div className="mt-5 flex flex-col gap-3">
            <OptionRow
              title="Efectivo"
              subtitle="Al recibir"
              active={payment === "efectivo"}
              onSelect={() => setPayment("efectivo")}
              icon={Banknote}
            />
            <OptionRow
              title="Transferencia"
              subtitle="Datos por SMS"
              active={payment === "transferencia"}
              onSelect={() => setPayment("transferencia")}
              icon={CreditCard}
            />
          </div>
        </section>

        <section className="rounded-lg bg-canvas p-5 shadow-card md:p-6">
          <p className="eyebrow">Tu pedido</p>
          <h2 className="mt-1.5 text-[15px] font-semibold text-ink">
            Resumen · {itemsCount}{" "}
            {itemsCount === 1 ? "artículo" : "artículos"}
          </h2>

          <dl className="mt-5 flex flex-col gap-2.5">
            <div className="flex justify-between text-[13.5px]">
              <dt className="text-slate-500">Subtotal</dt>
              <dd className="tabular font-medium text-ink">
                {fmt(totals.subtotal, currency)}
              </dd>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-[13.5px]">
                <dt className="text-ok">Descuento</dt>
                <dd className="tabular font-medium text-ok">
                  −{fmt(totals.discount, currency)}
                </dd>
              </div>
            )}
            <div className="flex justify-between text-[13.5px]">
              <dt className="text-slate-500">Envío</dt>
              <dd className="tabular font-medium text-ink">
                {totals.shipping === 0
                  ? "Gratis"
                  : fmt(totals.shipping, currency)}
              </dd>
            </div>
            <div className="mt-1 flex items-baseline justify-between border-t border-line pt-3 text-[15px] font-semibold">
              <dt className="text-ink">Total</dt>
              <dd className="tabular text-[20px] font-bold text-navy-900">
                {fmt(totals.total, currency)}
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-col gap-2 text-[12.5px] leading-[1.65] text-slate-500">
            <p>
              {delivery === "domicilio"
                ? "Entrega estimada: 24–48 horas"
                : "Listo para recoger hoy mismo"}
            </p>
            {hasEstimatedLines && (
              <p>
                Este pedido incluye productos de peso variable: el total se
                ajusta al peso real al preparar tu pedido.
              </p>
            )}
          </div>

          {error?.field === "cart" && (
            <p className="mt-4 rounded-md bg-danger-soft px-4 py-3 text-[13px] text-danger">
              {error.message}
            </p>
          )}

          <Button
            variant="solid"
            size="lg"
            onClick={handleSubmit}
            disabled={sending}
            className="tabular mt-6 w-full"
          >
            {sending && <Loader2 className="h-4 w-4 animate-spin" />}
            {sending
              ? "Enviando…"
              : `Confirmar pedido · ${fmt(totals.total, currency)}`}
          </Button>
        </section>
      </div>
    </div>
  );
}
