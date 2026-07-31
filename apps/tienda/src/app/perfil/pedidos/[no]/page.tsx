"use client";

import { useParams } from "next/navigation";
import { PackageSearch } from "lucide-react";
import { fmt } from "@/lib/format";
import { useStore, type StoredOrder } from "@/lib/store";
import { EmptyState } from "@/components/empty-state";
import { ScreenHeader } from "@/components/screen-header";

const STATUS_COLOR: Record<StoredOrder["status"], string> = {
  "En preparación": "text-ok",
  "En revisión": "text-warn",
  "Por pesar": "text-warn",
};

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
    <div className="flex items-baseline justify-between gap-4 border-b border-line-soft py-3">
      <dt className={`text-[13px] ${tone ?? "text-slate-500"}`}>{label}</dt>
      <dd className={`tabular text-[13px] ${tone ?? "text-ink"}`}>{value}</dd>
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
        <div className="px-5 pt-8 md:px-10">
          <div className="h-4 w-40 bg-surface" />
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
      >
        <span className={`nav-label ${STATUS_COLOR[order.status] ?? "text-slate-500"}`}>
          {order.status}
        </span>
      </ScreenHeader>

      <div className="px-5 pb-16 md:px-10">
        <div className="border-b border-line py-7">
          <p className="tabular text-[13px] text-slate-400">
            {formatOrderDate(order.dateIso)} · {order.itemsCount}{" "}
            {order.itemsCount === 1 ? "artículo" : "artículos"}
          </p>
          {STATUS_NOTE[order.status] && (
            <p className="mt-3 max-w-[520px] text-[13px] leading-[1.65] text-pretty text-slate-500">
              {STATUS_NOTE[order.status]}
            </p>
          )}
        </div>

        <section className="border-b border-line py-8">
          <h2 className="eyebrow">Artículos</h2>
          {order.lines?.length ? (
            <div className="mt-5">
              {order.lines.map((line) => (
                <div
                  key={line.sku}
                  className="flex items-start justify-between gap-5 border-b border-line-soft py-4"
                >
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-ink">
                      {line.name}
                    </p>
                    <p className="tabular mt-1.5 text-[12px] text-slate-400">
                      {line.presentationName ? `${line.presentationName} · ` : ""}
                      {line.qty} × {fmt(line.unitPrice, currency)}
                      {line.isCatchWeight ? " / kg" : ""}
                    </p>
                  </div>
                  <p className="tabular flex-none text-[14px] font-semibold text-navy-900">
                    {fmt(line.total, currency)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-5 max-w-[520px] text-[13px] leading-[1.65] text-pretty text-slate-500">
              Este pedido se guardó antes de que la tienda registrara el detalle
              de los artículos, así que solo conservamos el importe total.
            </p>
          )}
        </section>

        <section className="border-b border-line py-8">
          <h2 className="eyebrow">Resumen</h2>
          <dl className="mt-5 max-w-[420px]">
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
            <div className="flex items-baseline justify-between gap-4 pt-4">
              <dt className="text-[13px] font-semibold text-ink">Total</dt>
              <dd className="tabular text-[21px] font-bold text-navy-900">
                {fmt(order.total, currency)}
              </dd>
            </div>
          </dl>
        </section>

        {(order.delivery || order.payment) && (
          <section className="py-8">
            <h2 className="eyebrow">Entrega y pago</h2>
            <dl className="mt-5 max-w-[420px]">
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
