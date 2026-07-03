"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { submitOrder } from "@/app/actions/order-actions";
import { computeTotals } from "@/lib/cart-totals";
import { fmt } from "@/lib/format";
import { cartCount, cartLines, useStore } from "@/lib/store";
import { EmptyState } from "@/components/empty-state";
import { ScreenHeader } from "@/components/screen-header";

type Delivery = "domicilio" | "recogida";
type Payment = "efectivo" | "transferencia";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputClass =
  "rounded-xl border border-line bg-white px-3.5 py-[13px] text-sm text-ink placeholder:text-muted-2";

function OptionCard({
  title,
  subtitle,
  active,
  onSelect,
}: {
  title: string;
  subtitle: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex-1 rounded-[13px] border-[1.5px] px-3.5 py-3 text-left ${
        active ? "border-brand bg-chip" : "border-line bg-white"
      }`}
    >
      <div className="text-[13.5px] font-semibold text-navy">{title}</div>
      <div className="mt-0.5 text-xs text-muted">{subtitle}</div>
    </button>
  );
}

export function CheckoutForm() {
  const router = useRouter();
  const { state, addOrder, clearCart, setProfile, showToast } = useStore();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [delivery, setDelivery] = useState<Delivery>("domicilio");
  const [payment, setPayment] = useState<Payment>("efectivo");
  const [sending, setSending] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

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

  const handleSubmit = async () => {
    if (sending) return;
    if (!name.trim()) {
      showToast("Completa tu nombre");
      return;
    }
    if (!phone.trim()) {
      showToast("Escribe tu teléfono");
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      showToast("Escribe un correo válido");
      return;
    }
    if (delivery === "domicilio" && !address.trim()) {
      showToast("Escribe tu dirección de entrega");
      return;
    }
    if (lines.length === 0) {
      showToast("Tu carrito está vacío");
      return;
    }

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
        })),
        delivery,
        payment,
        couponApplied: state.couponApplied,
        total: totals.total,
      });

      if (!result.success) {
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
        `/pedido-confirmado?no=${encodeURIComponent(result.data.orderNo)}`
      );
    } finally {
      setSending(false);
    }
  };

  if (state.hydrated && lines.length === 0) {
    return (
      <div className="flex flex-1 flex-col">
        <ScreenHeader title="Finalizar compra" backHref="/carrito" />
        <EmptyState
          icon="🛒"
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
      <ScreenHeader title="Finalizar compra" backHref="/carrito" />

      <div className="flex flex-1 flex-col gap-[18px] px-5 py-[18px]">
        <div>
          <div className="mb-2.5 text-[13.5px] font-semibold text-navy">
            Datos de contacto
          </div>
          <div className="flex flex-col gap-2.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre y apellidos"
              autoComplete="name"
              className={inputClass}
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Teléfono"
              type="tel"
              autoComplete="tel"
              className={inputClass}
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Correo electrónico"
              type="email"
              autoComplete="email"
              className={inputClass}
            />
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Dirección de entrega"
              autoComplete="street-address"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <div className="mb-2.5 text-[13.5px] font-semibold text-navy">
            Entrega
          </div>
          <div className="flex gap-2.5">
            <OptionCard
              title="A domicilio"
              subtitle="$5.00 · 24–48 h"
              active={delivery === "domicilio"}
              onSelect={() => setDelivery("domicilio")}
            />
            <OptionCard
              title="Recoger en tienda"
              subtitle="Gratis · hoy mismo"
              active={delivery === "recogida"}
              onSelect={() => setDelivery("recogida")}
            />
          </div>
        </div>

        <div>
          <div className="mb-2.5 text-[13.5px] font-semibold text-navy">
            Pago
          </div>
          <div className="flex gap-2.5">
            <OptionCard
              title="Efectivo"
              subtitle="Al recibir"
              active={payment === "efectivo"}
              onSelect={() => setPayment("efectivo")}
            />
            <OptionCard
              title="Transferencia"
              subtitle="Datos por SMS"
              active={payment === "transferencia"}
              onSelect={() => setPayment("transferencia")}
            />
          </div>
        </div>

        <div className="rounded-[15px] bg-white p-4 shadow-[0_3px_12px_rgba(10,31,63,.05)]">
          <div className="mb-2.5 text-[13.5px] font-semibold text-navy">
            Resumen · {itemsCount} artículos
          </div>
          <div className="mb-[5px] flex justify-between text-[13px] text-ink-soft">
            <span>Subtotal</span>
            <span>{fmt(totals.subtotal)}</span>
          </div>
          {totals.discount > 0 && (
            <div className="mb-[5px] flex justify-between text-[13px] text-ok">
              <span>Descuento</span>
              <span>−{fmt(totals.discount)}</span>
            </div>
          )}
          <div className="mb-[9px] flex justify-between text-[13px] text-ink-soft">
            <span>Envío</span>
            <span>{totals.shipping === 0 ? "Gratis" : fmt(totals.shipping)}</span>
          </div>
          <div className="flex justify-between border-t border-dashed border-line pt-[9px] text-[15px] font-bold text-navy">
            <span>Total</span>
            <span>{fmt(totals.total)}</span>
          </div>
          <div className="mt-2.5 text-xs text-muted">
            {delivery === "domicilio"
              ? "Entrega estimada: 24–48 horas"
              : "Listo para recoger hoy mismo"}
          </div>
        </div>
      </div>

      <div className="border-t border-line-2 bg-white px-5 pt-3.5 pb-6">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={sending}
          className={`grad-cta w-full rounded-[13px] p-[15px] text-center text-[15px] font-semibold text-white ${
            sending ? "opacity-60" : ""
          }`}
        >
          {sending
            ? "Enviando…"
            : `Confirmar pedido · ${fmt(totals.total)}`}
        </button>
      </div>
    </div>
  );
}
