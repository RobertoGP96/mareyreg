"use client";

import { useParams } from "next/navigation";
import { PackageSearch } from "lucide-react";
import { fmt } from "@/lib/format";
import { useStore, type StoredOrder } from "@/lib/store";
import { EmptyState } from "@/components/empty-state";
import { ScreenHeader } from "@/components/screen-header";

const PILL =
  "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none";

const STATUS_PILL: Record<StoredOrder["status"], string> = {
  "En preparación": "bg-tint text-navy-700",
  "Por pesar": "bg-gold-100 text-gold-600",
  "En revisión": "bg-surface text-slate-500",
};

// Los pedidos viven en localStorage: un estado guardado por una versión previa
// puede no estar en el mapa, así que hay estilo de reserva.
function statusPillClass(status: StoredOrder["status"]): string {
  return `${PILL} ${STATUS_PILL[status] ?? "bg-surface text-slate-500"}`;
}

const STATUS_NOTE: Record<StoredOrder["status"], string> = {
  "En preparación": "Estamos preparando tu pedido para la entrega.",
  "En revisión":
    "Un agente está revisando el pedido y te contactará para confirmarlo.",
  "Por pesar":
    "Tu pedido lleva productos de peso variable. Los pesamos y luego confirmamos el importe final.",
};

function formatOrderDate(dateIso: string): string {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

const CARD = "rounded-lg bg-canvas p-4 shadow-card md:p-5";

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={`text-[13px] ${tone ?? "text-slate-500"}`}>{label}</dt>
      <dd
        className={`tabular text-right text-[13.5px] font-medium ${tone ?? "text-ink"}`}
      >
        {value}
      </dd>
    </div>
  );
}

export default function OrderDetailPage() {
  const params = useParams<{ no: string }>();
  const { state } = useStore();

  const orderNo = decodeURIComponent(
    Array.isArray(params.no) ? (params.no[0] ?? "") : (params.no ?? "")
  );
  const order = state.orders.find((o) => o.no === orderNo);
  const currency = state.currency;

  // Los pedidos llegan de localStorage: antes de hidratar la lista está vacía y
  // pintar "no encontrado" sería un falso negativo en cada carga.
  if (!state.hydrated) {
    return (
      <div className="flex flex-1 flex-col">
        <ScreenHeader eyebrow="Mi cuenta" title="Pedido" backHref="/perfil/pedidos" />
        <div className="mx-auto w-full max-w-[720px] px-5 pb-14 md:px-6">
          <div className={CARD}>
            <div className="h-4 w-40 rounded-full bg-surface" />
            <div className="mt-3 h-3 w-24 rounded-full bg-surface" />
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-1 flex-col">
        <ScreenHeader eyebrow="Mi cuenta" title="Pedido" backHref="/perfil/pedidos" />
        <EmptyState
          icon={PackageSearch}
          eyebrow="No encontrado"
          title="Ese pedido no está aquí"
          description="El historial se guarda en este dispositivo, así que un pedido hecho en otro navegador no aparecerá."
          ctaLabel="Ver mis pedidos"
          ctaHref="/perfil/pedidos"
        />
      </div>
    );
  }

  const hasBreakdown = order.subtotal != null;

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader
        eyebrow="Mi cuenta"
        title={`Pedido ${order.no}`}
        backHref="/perfil/pedidos"
      />

      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-5 pb-14 md:px-6">
        <div className={CARD}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="tabular text-[14px] font-semibold text-ink">
                Pedido {order.no}
              </p>
              <p className="tabular mt-1 text-[12.5px] text-slate-500">
                {formatOrderDate(order.dateIso)} · {order.itemsCount}{" "}
                {order.itemsCount === 1 ? "artículo" : "artículos"}
              </p>
            </div>
            <span className={`${statusPillClass(order.status)} flex-none`}>
              {order.status}
            </span>
          </div>
          {STATUS_NOTE[order.status] && (
            <p className="mt-3 border-t border-line-soft pt-3 text-[13px] leading-[1.65] text-pretty text-slate-500">
              {STATUS_NOTE[order.status]}
            </p>
          )}
        </div>

        <section>
          <h2 className="eyebrow mb-2.5">Artículos</h2>
          <div className="rounded-lg bg-canvas px-4 shadow-card md:px-5">
            {order.lines?.length ? (
              <div className="divide-y divide-line-soft">
                {order.lines.map((line) => (
                  <div
                    key={line.sku}
                    className="flex justify-between gap-4 py-3 text-[13.5px]"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{line.name}</p>
                      <p className="tabular mt-1 text-[12.5px] text-slate-500">
                        {[line.modelLabel, line.presentationName]
                          .filter(Boolean)
                          .map((part) => `${part} · `)
                          .join("")}
                        {line.qty} × {fmt(line.unitPrice, currency)}
                        {line.isCatchWeight ? " / kg" : ""}
                      </p>
                    </div>
                    <p className="tabular flex-none font-semibold text-navy-900">
                      {fmt(line.total, currency)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-[13px] leading-[1.65] text-pretty text-slate-500">
                Este pedido se guardó antes de que la tienda registrara el detalle
                de los artículos, así que solo conservamos el importe total.
              </p>
            )}
          </div>
        </section>

        <section>
          <h2 className="eyebrow mb-2.5">Resumen</h2>
          <dl className={`${CARD} flex flex-col gap-2.5`}>
            {hasBreakdown && (
              <>
                <SummaryRow
                  label="Subtotal"
                  value={fmt(order.subtotal ?? 0, currency)}
                />
                {(order.discount ?? 0) > 0 && (
                  <SummaryRow
                    label="Descuento"
                    value={`−${fmt(order.discount ?? 0, currency)}`}
                    tone="text-ok"
                  />
                )}
                <SummaryRow
                  label="Envío"
                  value={
                    (order.shipping ?? 0) > 0
                      ? fmt(order.shipping ?? 0, currency)
                      : "Gratis"
                  }
                />
              </>
            )}
            <div
              className={`flex items-baseline justify-between gap-4 ${
                hasBreakdown ? "mt-1 border-t border-line-soft pt-3" : ""
              }`}
            >
              <dt className="text-[13px] font-semibold text-ink">Total</dt>
              <dd className="tabular text-[20px] font-bold text-navy-900">
                {fmt(order.total, currency)}
              </dd>
            </div>
          </dl>
        </section>

        {(order.delivery || order.payment) && (
          <section>
            <h2 className="eyebrow mb-2.5">Entrega y pago</h2>
            <dl className={`${CARD} flex flex-col gap-2.5`}>
              {order.delivery && (
                <SummaryRow
                  label="Entrega"
                  value={
                    order.delivery === "recogida"
                      ? "Recogida en tienda"
                      : "A domicilio"
                  }
                />
              )}
              {order.address && (
                <SummaryRow label="Dirección" value={order.address} />
              )}
              {order.payment && (
                <SummaryRow label="Pago" value={order.payment} />
              )}
            </dl>
          </section>
        )}
      </div>
    </div>
  );
}
