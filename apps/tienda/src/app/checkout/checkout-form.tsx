"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Banknote,
  CreditCard,
  Loader2,
  Store,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { submitOrder } from "@/app/actions/order-actions";
import { computeTotals, SHIPPING_COST } from "@/lib/cart-totals";
import { fmt } from "@/lib/format";
import { cartCount, cartLines, useStore } from "@/lib/store";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Delivery = "domicilio" | "recogida";
type Payment = "efectivo" | "transferencia";
type FieldKey = "name" | "phone" | "email" | "address" | "cart";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
      className={`flex w-full items-center gap-3.5 border px-4 py-3.5 text-left transition-colors duration-150 ${
        active ? "border-navy-900" : "border-line hover:border-navy-900"
      }`}
    >
      {Icon && (
        <Icon
          className={`h-4 w-4 flex-none ${
            active ? "text-navy-900" : "text-slate-400"
          }`}
          strokeWidth={1.6}
        />
      )}
      <span className="min-w-0 flex-1">
        <span
          className={`block text-[13.5px] ${
            active ? "font-bold text-navy-900" : "font-medium text-ink"
          }`}
        >
          {title}
        </span>
        <span className="tabular mt-0.5 block text-[12px] text-slate-400">
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
    <section className="border-b border-line px-5 pt-12 pb-9 md:px-10">
      <p className="eyebrow">Paso final</p>
      <h1 className="font-display mt-4 text-[42px] leading-none text-navy-900 md:text-[56px]">
        Finalizar compra
      </h1>
      <Link
        href="/carrito"
        className="mt-6 inline-block border-b border-line text-[11.5px] font-medium tracking-[.16em] text-slate-400 uppercase transition-colors duration-150 hover:border-navy-900 hover:text-navy-900"
      >
        Volver al carrito
      </Link>
    </section>
  );

  if (state.hydrated && lines.length === 0) {
    return (
      <div className="flex flex-1 flex-col">
        {header}
        <div className="flex flex-1 flex-col items-center justify-center px-5 py-24 text-center md:px-10">
          <p className="eyebrow">Sin artículos</p>
          <p className="font-display mt-4 text-[32px] leading-none text-navy-900">
            Tu carrito está vacío
          </p>
          <p className="mt-4 max-w-[380px] text-[13.5px] leading-[1.65] text-pretty text-slate-500">
            Explora el catálogo y añade productos.
          </p>
          <ButtonLink href="/catalogo" className="mt-7">
            Ir al catálogo
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {header}

      <div className="mx-auto w-full max-w-[560px] px-5 pb-20 md:px-10">
        <section className="py-9">
          <h2 className="eyebrow">Datos de contacto</h2>
          <div className="mt-6 flex flex-col gap-5">
            <div>
              <label htmlFor="checkout-name" className="eyebrow">
                Nombre y apellidos
              </label>
              <Input
                id="checkout-name"
                className="mt-2.5"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre y apellidos"
                autoComplete="name"
                aria-invalid={error?.field === "name" || undefined}
              />
              {fieldError("name")}
            </div>
            <div>
              <label htmlFor="checkout-phone" className="eyebrow">
                Teléfono
              </label>
              <Input
                id="checkout-phone"
                className="mt-2.5"
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
              <label htmlFor="checkout-email" className="eyebrow">
                Correo electrónico
              </label>
              <Input
                id="checkout-email"
                className="mt-2.5"
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
              <label htmlFor="checkout-address" className="eyebrow">
                Dirección de entrega
              </label>
              <Input
                id="checkout-address"
                className="mt-2.5"
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

        <section className="border-t border-line py-9">
          <h2 className="eyebrow">Entrega</h2>
          <div className="mt-6 flex flex-col gap-3">
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

        <section className="border-t border-line py-9">
          <h2 className="eyebrow">Pago</h2>
          <div className="mt-6 flex flex-col gap-3">
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

        <section className="border-t border-line py-9">
          <h2 className="eyebrow">
            Resumen · {itemsCount}{" "}
            {itemsCount === 1 ? "artículo" : "artículos"}
          </h2>

          <dl className="mt-6">
            <div className="flex items-baseline justify-between gap-4 border-b border-line-soft py-3">
              <dt className="text-[13px] text-slate-500">Subtotal</dt>
              <dd className="tabular text-[13px] text-ink">
                {fmt(totals.subtotal, currency)}
              </dd>
            </div>
            {totals.discount > 0 && (
              <div className="flex items-baseline justify-between gap-4 border-b border-line-soft py-3">
                <dt className="text-[13px] text-ok">Descuento</dt>
                <dd className="tabular text-[13px] text-ok">
                  −{fmt(totals.discount, currency)}
                </dd>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-4 border-b border-line py-3">
              <dt className="text-[13px] text-slate-500">Envío</dt>
              <dd className="tabular text-[13px] text-ink">
                {totals.shipping === 0
                  ? "Gratis"
                  : fmt(totals.shipping, currency)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 pt-5">
              <dt className="text-[13px] font-semibold text-ink">Total</dt>
              <dd className="tabular text-[21px] font-bold text-navy-900">
                {fmt(totals.total, currency)}
              </dd>
            </div>
          </dl>

          <p className="mt-5 text-[12.5px] leading-[1.65] text-slate-500">
            {delivery === "domicilio"
              ? "Entrega estimada: 24–48 horas"
              : "Listo para recoger hoy mismo"}
          </p>
          {hasEstimatedLines && (
            <p className="mt-2 text-[12.5px] leading-[1.65] text-slate-500">
              Este pedido incluye productos de peso variable: el total se ajusta
              al peso real al preparar tu pedido.
            </p>
          )}

          {error?.field === "cart" && (
            <p className="mt-4 text-[12px] text-danger">{error.message}</p>
          )}

          <Button
            variant="solid"
            size="lg"
            onClick={handleSubmit}
            disabled={sending}
            className="tabular mt-8 w-full"
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
