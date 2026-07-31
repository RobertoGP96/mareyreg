"use client";

import Link from "next/link";
import { Package } from "lucide-react";
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

const STATUS_COLOR: Record<StoredOrder["status"], string> = {
  "En preparación": "text-ok",
  "En revisión": "text-warn",
  "Por pesar": "text-warn",
};

// Los pedidos viven en localStorage: un estado guardado por una versión previa
// puede no estar en el mapa, así que hay color de reserva.
function statusColor(status: StoredOrder["status"]): string {
  return STATUS_COLOR[status] ?? "text-slate-500";
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
        <div className="px-5 pt-8 pb-16 md:px-10">
          {orders.map((order) => (
            <Link
              key={order.no}
              href={`/perfil/pedidos/${encodeURIComponent(order.no)}`}
              className="flex items-start justify-between gap-5 border-b border-line-soft py-5 transition-colors duration-150 hover:bg-hover"
            >
              <div className="min-w-0">
                <div className="tabular text-[14px] font-semibold text-ink">
                  Pedido {order.no}
                </div>
                <div className="tabular mt-1.5 text-[12px] text-slate-400">
                  {formatOrderDate(order.dateIso)} · {order.itemsCount}{" "}
                  {order.itemsCount === 1 ? "artículo" : "artículos"}
                </div>
              </div>
              <div className="flex-none text-right">
                <div className="tabular text-[15px] font-bold text-navy-900">
                  {fmt(order.total, currency)}
                </div>
                <div
                  className={`nav-label mt-1.5 ${statusColor(order.status)}`}
                >
                  {order.status}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
