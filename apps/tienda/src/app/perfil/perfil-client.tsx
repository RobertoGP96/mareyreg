"use client";

import Link from "next/link";
import {
  ChevronRight,
  FileText,
  HelpCircle,
  LogOut,
  MapPin,
  Package,
  UserRound,
} from "lucide-react";
import { useStore } from "@/lib/store";

export function PerfilClient() {
  const { state, clearProfile, showToast } = useStore();
  const profile = state.profile;
  const ordersCount = state.orders.length;

  const ordersSummary =
    ordersCount === 0
      ? "Sin pedidos todavía"
      : `${ordersCount} ${ordersCount === 1 ? "pedido" : "pedidos"}`;

  return (
    <div className="flex flex-1 flex-col">
      <div className="grad-header flex items-center gap-3.5 rounded-b-[22px] p-5 text-white md:mt-6 md:rounded-[22px] md:mx-auto md:w-full md:max-w-2xl">
        <div className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl border border-white/18 bg-white/12 text-xl font-bold">
          {profile ? (
            profile.name.trim().charAt(0).toUpperCase()
          ) : (
            <UserRound className="h-6 w-6" />
          )}
        </div>
        <div>
          <div className="text-base font-bold">
            {profile ? profile.name : "Cliente invitado"}
          </div>
          <div className="mt-0.5 text-xs text-[#7FA8E8]">
            {profile ? profile.phone : "Inicia sesión o crea tu cuenta"}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-5 py-[18px] md:mx-auto md:w-full md:max-w-2xl">
        {!profile && (
          <div className="rounded-[15px] bg-white p-4 shadow-[0_3px_12px_rgba(10,31,63,.05)]">
            <div className="text-[13.5px] font-semibold text-navy">
              Accede a tu cuenta
            </div>
            <div className="mt-[3px] text-[12.5px] leading-[1.45] text-muted">
              Guarda tus datos, direcciones y sigue tus pedidos.
            </div>
            <div className="mt-3 flex gap-2.5">
              <Link
                href="/login"
                className="grad-cta flex-1 rounded-[11px] p-3 text-center text-[13px] font-semibold text-white transition-colors hover:opacity-90"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/registro"
                className="flex-1 rounded-[11px] bg-chip p-3 text-center text-[13px] font-semibold text-brand transition-colors hover:bg-brand/10"
              >
                Crear cuenta
              </Link>
            </div>
          </div>
        )}

        <Link
          href="/perfil/pedidos"
          className="flex items-center gap-[13px] rounded-[15px] bg-white px-4 py-3.5 shadow-[0_3px_12px_rgba(10,31,63,.05)] transition-colors hover:bg-app"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-chip text-brand">
            <Package className="h-[18px] w-[18px]" />
          </div>
          <div className="flex-1">
            <div className="text-[13.5px] font-semibold text-navy">
              Mis pedidos
            </div>
            <div className="mt-0.5 text-xs text-muted">{ordersSummary}</div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-2" />
        </Link>

        <div className="mt-2 text-sm font-semibold text-navy">Cuenta</div>
        <div className="overflow-hidden rounded-[15px] bg-white shadow-[0_3px_12px_rgba(10,31,63,.05)]">
          {profile && (
            <Link
              href="/perfil/datos"
              className="flex items-center gap-3 border-b border-app px-4 py-3.5 transition-colors hover:bg-app"
            >
              <UserRound className="h-[18px] w-[18px] text-brand" />
              <span className="flex-1 text-[13.5px] text-ink">Mis datos</span>
              <ChevronRight className="h-4 w-4 text-muted-2" />
            </Link>
          )}
          <div className="flex items-center gap-3 border-b border-app px-4 py-3.5 transition-colors hover:bg-app">
            <MapPin className="h-[18px] w-[18px] text-brand" />
            <span className="flex-1 text-[13.5px] text-ink">
              Direcciones de entrega
            </span>
            <ChevronRight className="h-4 w-4 text-muted-2" />
          </div>
          <div className="flex items-center gap-3 border-b border-app px-4 py-3.5 transition-colors hover:bg-app">
            <HelpCircle className="h-[18px] w-[18px] text-brand" />
            <span className="flex-1 text-[13.5px] text-ink">
              Ayuda y soporte
            </span>
            <ChevronRight className="h-4 w-4 text-muted-2" />
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-app">
            <FileText className="h-[18px] w-[18px] text-brand" />
            <span className="flex-1 text-[13.5px] text-ink">
              Términos y condiciones
            </span>
            <ChevronRight className="h-4 w-4 text-muted-2" />
          </div>
        </div>

        {profile && (
          <button
            type="button"
            onClick={() => {
              clearProfile();
              showToast("Sesión cerrada");
            }}
            className="flex items-center gap-3 rounded-[15px] bg-white px-4 py-3.5 text-left shadow-[0_3px_12px_rgba(10,31,63,.05)] transition-colors hover:bg-app"
          >
            <LogOut className="h-[18px] w-[18px] text-danger" />
            <span className="flex-1 text-[13.5px] font-medium text-danger">
              Cerrar sesión
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
