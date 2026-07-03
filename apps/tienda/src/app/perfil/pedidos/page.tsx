"use client";

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

function statusClasses(status: StoredOrder["status"]): string {
  return status === "En preparación"
    ? "bg-ok-bg text-ok"
    : "bg-[#F5ECDC] text-warn";
}

export default function OrdersPage() {
  const { state } = useStore();
  const orders = state.orders;
  const currency = state.currency;

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Mis pedidos" backHref="/perfil" />

      {orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Aún no tienes pedidos"
          description="Cuando compres, podrás seguirlos aquí."
          ctaLabel="Ir al catálogo"
          ctaHref="/catalogo"
        />
      ) : (
        <div className="flex flex-col gap-3 px-5 py-[18px] md:mx-auto md:w-full md:max-w-2xl">
          {orders.map((order) => (
            <div
              key={order.no}
              className="rounded-[15px] bg-white px-4 py-[15px] shadow-[0_3px_12px_rgba(10,31,63,.05)] transition-colors hover:bg-app"
            >
              <div className="flex items-center gap-[13px]">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-chip text-brand">
                  <Package className="h-[18px] w-[18px]" />
                </div>
                <div className="flex-1">
                  <div className="text-[13.5px] font-semibold text-navy">
                    Pedido {order.no}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {formatOrderDate(order.dateIso)} · {order.itemsCount}{" "}
                    artículos · {fmt(order.total, currency)}
                  </div>
                </div>
                <div
                  className={`rounded-lg px-2.5 py-[5px] text-[11px] font-semibold ${statusClasses(order.status)}`}
                >
                  {order.status}
                </div>
              </div>
              <div className="mt-3.5 flex items-center gap-1.5">
                <div className="grad-progress h-[5px] flex-1 rounded-[3px]" />
                <div className="h-[5px] flex-1 rounded-[3px] bg-photo" />
                <div className="h-[5px] flex-1 rounded-[3px] bg-photo" />
              </div>
              <div className="mt-1.5 flex justify-between text-[10.5px] text-muted">
                <span className="font-semibold text-brand">Preparación</span>
                <span>En camino</span>
                <span>Entregado</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
