"use client";

import Link from "next/link";
import {
  ChevronRight,
  CircleHelp,
  FileText,
  IdCard,
  MapPin,
  Package,
  SunMoon,
  UserRound,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { ScreenHeader } from "@/components/screen-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, ButtonLink } from "@/components/ui/button";

const CARD =
  "overflow-hidden rounded-lg bg-canvas shadow-card divide-y divide-line-soft";
const ROW =
  "flex w-full items-center justify-between gap-4 px-4 py-3.5 text-[14px] text-ink transition-colors duration-150 hover:bg-hover";
// Filas sin destino todavía: mismo ritmo que las activas pero sin hover ni tinta.
const ROW_INERT =
  "flex w-full items-center justify-between gap-4 px-4 py-3.5 text-[14px] text-slate-400";
const ROW_ICON = "h-[18px] w-[18px] flex-none";

export function PerfilClient() {
  const { state, clearProfile, showToast } = useStore();
  const profile = state.profile;
  const ordersCount = state.orders.length;

  const ordersSummary =
    ordersCount === 0
      ? "Sin pedidos todavía"
      : `${ordersCount} ${ordersCount === 1 ? "pedido" : "pedidos"}`;

  const initial = profile?.name.trim().charAt(0).toUpperCase() ?? "";

  return (
    <div className="flex flex-1 flex-col">
      {/* Con sesión, nombre y teléfono ya van en la tarjeta de identidad de
          abajo: repetirlos en la cabecera los mostraba dos veces seguidas. */}
      <ScreenHeader
        eyebrow="Mi cuenta"
        title={profile ? "Tu cuenta" : "Cliente invitado"}
      >
        {!profile && (
          <span className="text-[13px] text-slate-400">
            Inicia sesión o crea tu cuenta
          </span>
        )}
      </ScreenHeader>

      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-5 pb-14 md:px-6">
        {profile ? (
          <div className="flex items-center gap-4 rounded-lg bg-canvas p-4 shadow-card md:p-5">
            <span
              aria-hidden
              className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-navy-700 text-[16px] font-bold text-on-brand"
            >
              {initial || <UserRound className="h-5 w-5" strokeWidth={2} />}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-ink">
                {profile.name}
              </p>
              <p className="tabular mt-0.5 truncate text-[13px] text-slate-500">
                {profile.phone}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-canvas p-6 text-center shadow-card">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tint text-navy-700">
              <UserRound className="h-[22px] w-[22px]" strokeWidth={1.8} />
            </span>
            <p className="mt-4 text-[18px] font-semibold text-navy-900">
              Accede a tu cuenta
            </p>
            <p className="mx-auto mt-1.5 max-w-[420px] text-[13.5px] leading-[1.65] text-pretty text-slate-500">
              Guarda tus datos, direcciones y sigue tus pedidos.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <ButtonLink href="/login" variant="solid">
                Iniciar sesión
              </ButtonLink>
              <ButtonLink href="/registro">Crear cuenta</ButtonLink>
            </div>
          </div>
        )}

        <section>
          <p className="eyebrow mb-2.5">Pedidos</p>
          <div className={CARD}>
            <Link href="/perfil/pedidos" className={ROW}>
              <span className="flex min-w-0 items-center gap-3">
                <Package className={`${ROW_ICON} text-navy-700`} strokeWidth={1.8} />
                <span className="truncate">Mis pedidos</span>
              </span>
              <span className="flex flex-none items-center gap-3">
                <span className="text-[13px] text-slate-400">{ordersSummary}</span>
                <ChevronRight className="h-4 w-4 text-slate-400" strokeWidth={2} />
              </span>
            </Link>
          </div>
        </section>

        <section>
          <p className="eyebrow mb-2.5">Cuenta</p>
          <div className={CARD}>
            {profile && (
              <Link href="/perfil/datos" className={ROW}>
                <span className="flex min-w-0 items-center gap-3">
                  <IdCard className={`${ROW_ICON} text-navy-700`} strokeWidth={1.8} />
                  <span className="truncate">Mis datos</span>
                </span>
                <ChevronRight className="h-4 w-4 flex-none text-slate-400" strokeWidth={2} />
              </Link>
            )}
            <div className={ROW_INERT}>
              <span className="flex min-w-0 items-center gap-3">
                <MapPin className={ROW_ICON} strokeWidth={1.8} />
                <span className="truncate">Direcciones de entrega</span>
              </span>
              <ChevronRight className="h-4 w-4 flex-none text-slate-400" strokeWidth={2} />
            </div>
            <div className={ROW_INERT}>
              <span className="flex min-w-0 items-center gap-3">
                <CircleHelp className={ROW_ICON} strokeWidth={1.8} />
                <span className="truncate">Ayuda y soporte</span>
              </span>
              <ChevronRight className="h-4 w-4 flex-none text-slate-400" strokeWidth={2} />
            </div>
            <div className={ROW_INERT}>
              <span className="flex min-w-0 items-center gap-3">
                <FileText className={ROW_ICON} strokeWidth={1.8} />
                <span className="truncate">Términos y condiciones</span>
              </span>
              <ChevronRight className="h-4 w-4 flex-none text-slate-400" strokeWidth={2} />
            </div>
          </div>
        </section>

        <section className="flex flex-col">
          <p className="eyebrow mb-2.5">Preferencias</p>
          <div className={CARD}>
            <div className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-[14px] text-ink">
              <span className="flex min-w-0 items-center gap-3">
                <SunMoon className={`${ROW_ICON} text-navy-700`} strokeWidth={1.8} />
                <span className="truncate">Tema</span>
              </span>
              <ThemeToggle showLabel />
            </div>
          </div>

          {profile && (
            <Button
              variant="ghost"
              onClick={() => {
                clearProfile();
                showToast("Sesión cerrada");
              }}
              className="mt-2 self-start text-danger hover:text-danger"
            >
              Cerrar sesión
            </Button>
          )}
        </section>
      </div>
    </div>
  );
}
