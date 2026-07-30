"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { ScreenHeader } from "@/components/screen-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { ButtonLink } from "@/components/ui/button";

const ROW =
  "flex items-center justify-between gap-4 border-b border-line-soft py-[18px] transition-colors duration-150";
const ROW_LABEL = "text-[14px] text-ink";

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
      <ScreenHeader
        eyebrow="Mi cuenta"
        title={profile ? profile.name : "Cliente invitado"}
      >
        <span className="tabular text-[13px] text-slate-400">
          {profile ? profile.phone : "Inicia sesión o crea tu cuenta"}
        </span>
      </ScreenHeader>

      {!profile && (
        <div className="border-b border-line px-5 py-8 md:px-10">
          <p className="eyebrow">Accede a tu cuenta</p>
          <p className="mt-4 max-w-[420px] text-[13.5px] leading-[1.65] text-slate-500">
            Guarda tus datos, direcciones y sigue tus pedidos.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-7">
            <ButtonLink href="/login">Iniciar sesión</ButtonLink>
            <ButtonLink href="/registro" variant="ghost">
              Crear cuenta
            </ButtonLink>
          </div>
        </div>
      )}

      <section className="px-5 pt-8 md:px-10">
        <p className="eyebrow">Pedidos</p>
        <Link href="/perfil/pedidos" className={`${ROW} mt-5 hover:bg-hover`}>
          <span className={ROW_LABEL}>Mis pedidos</span>
          <span className="flex items-center gap-3">
            <span className="text-[13px] text-slate-400">{ordersSummary}</span>
            <ChevronRight
              className="h-4 w-4 text-slate-400"
              strokeWidth={1.6}
            />
          </span>
        </Link>
      </section>

      <section className="px-5 pt-10 md:px-10">
        <p className="eyebrow">Cuenta</p>
        <div className="mt-5">
          {profile && (
            <Link href="/perfil/datos" className={`${ROW} hover:bg-hover`}>
              <span className={ROW_LABEL}>Mis datos</span>
              <ChevronRight
                className="h-4 w-4 text-slate-400"
                strokeWidth={1.6}
              />
            </Link>
          )}
          <div className={ROW}>
            <span className={ROW_LABEL}>Direcciones de entrega</span>
            <ChevronRight
              className="h-4 w-4 text-slate-400"
              strokeWidth={1.6}
            />
          </div>
          <div className={ROW}>
            <span className={ROW_LABEL}>Ayuda y soporte</span>
            <ChevronRight
              className="h-4 w-4 text-slate-400"
              strokeWidth={1.6}
            />
          </div>
          <div className={ROW}>
            <span className={ROW_LABEL}>Términos y condiciones</span>
            <ChevronRight
              className="h-4 w-4 text-slate-400"
              strokeWidth={1.6}
            />
          </div>
        </div>
      </section>

      <section className="px-5 pt-10 pb-12 md:px-10">
        <p className="eyebrow">Preferencias</p>
        <div className="mt-5">
          <div className={ROW}>
            <span className={ROW_LABEL}>Tema</span>
            <ThemeToggle showLabel />
          </div>
        </div>

        {profile && (
          <button
            type="button"
            onClick={() => {
              clearProfile();
              showToast("Sesión cerrada");
            }}
            className="nav-label mt-10 text-slate-400 transition-colors duration-150 hover:text-danger"
          >
            Cerrar sesión
          </button>
        )}
      </section>
    </div>
  );
}
