"use client";

import Link from "next/link";
import { ChevronRight, Package } from "lucide-react";
import { fmt } from "@/lib/format";
import { useStore, type StoredOrder } from "@/lib/store";
import { EmptyState } from "@/components/empty-state";
import { ScreenHeader } from "@/components/screen-header";

function formatOrderDate(dateIso: string): string {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return "Hoy";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getFullYear()}`;
}

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

export default function OrdersPage() {
  const { state } = useStore();
  const orders = state.orders;
  const currency = state.currency;

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader eyebrow="Mi cuenta" title="Mis pedidos" backHref="/perfil" />

      {orders.length === 0 ? (
        <EmptyState
          icon={Package}
          eyebrow="Historial vacío"
          title="Aún no tienes pedidos"
          description="Cuando compres, podrás seguirlos aquí."
          ctaLabel="Ir al catálogo"
          ctaHref="/catalogo"
        />
      ) : (
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-3 px-5 pb-14 md:px-6">
          {orders.map((order) => (
            <Link
              key={order.no}
              href={`/perfil/pedidos/${encodeURIComponent(order.no)}`}
              className="group flex items-center gap-4 rounded-lg bg-canvas p-4 shadow-card transition-[box-shadow,transform] duration-200 hover:shadow-float motion-safe:hover:-translate-y-0.5 md:p-5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="tabular text-[14px] font-semibold text-ink">
                    Pedido {order.no}
                  </span>
                  <span className={statusPillClass(order.status)}>
                    {order.status}
                  </span>
                </div>
                <p className="tabular mt-1.5 text-[12.5px] text-slate-500">
                  {formatOrderDate(order.dateIso)} · {order.itemsCount}{" "}
                  {order.itemsCount === 1 ? "artículo" : "artículos"}
                </p>
              </div>
              <div className="flex flex-none items-center gap-2">
                <span className="tabular text-[15px] font-bold text-navy-900">
                  {fmt(order.total, currency)}
                </span>
                <ChevronRight
                  className="h-4 w-4 text-slate-400 transition-colors duration-150 group-hover:text-navy-700"
                  strokeWidth={2}
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
